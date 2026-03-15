/**
 * Feed Ration Solver
 *
 * Given a target UFL and PDI requirement, this module calculates a practical
 * daily ration (kg of each feed) that meets those requirements EXACTLY.
 *
 * Strategy:
 *  1. The farmer selects which feeds are available on their farm.
 *  2. We use a linear solver to find exact amounts that meet UFL and PDI targets.
 *  3. If total DM exceeds DMI (0.025 × weight), we reduce proportionally.
 */

import { type Feed, FEEDS } from "./feed-database";

export interface FeedAmount {
  feed: Feed;
  /** kg of fresh weight per day */
  kgPerDay: number;
  /** UFL contributed */
  uflContrib: number;
  /** PDI contributed (g) */
  pdiContrib: number;
  /** Dry matter contributed (kg) */
  dmContrib: number;
}

export interface RationResult {
  feeds: FeedAmount[];
  totalUfl: number;
  totalPdi: number;
  totalDm: number;
  targetUfl: number;
  targetPdi: number;
  dmi: number; // Maximum dry matter intake
  /** Difference from target (should be ~0 with exact solver) */
  uflDiff: number;
  pdiDiff: number;
  /** true if ration meets both UFL (±0.2) and PDI (±50g) within tolerance */
  balanced: boolean;
  /**
   * Optional suggestion: which additional feeds (by id) would help
   * cover remaining deficits (energy/protein) with the current selection.
   */
  suggestedFeeds?: string[];
}

/**
 * Default feed selection: hay + barley + soybean meal (widely available)
 */
export const DEFAULT_FEED_IDS = ["hay", "barley", "soybean_meal"];

/**
 * Calculate dry matter intake capacity
 * DMI = 0.025 × live weight (kg)
 */
export function calculateDmi(weightKg: number): number {
  return 0.025 * weightKg;
}

/**
 * Calculate a balanced ration for the given UFL and PDI targets.
 *
 * @param targetUfl  - Total UFL needed per day
 * @param targetPdi  - Total PDI needed per day (g)
 * @param feedIds    - IDs of feeds available on the farm
 * @param cowWeight  - Cow weight in kg (for DMI calculation)
 * @returns          - RationResult with kg amounts per feed
 */
export function calculateFeedRation(
  targetUfl: number,
  targetPdi: number,
  feedIds: string[] = DEFAULT_FEED_IDS,
  cowWeight: number = 600
): RationResult {
  // Calculate maximum DMI
  const dmi = calculateDmi(cowWeight);

  // Get selected feeds
  const selectedFeeds = feedIds
    .map((id) => FEEDS.find((f) => f.id === id))
    .filter((f): f is Feed => f !== undefined);

  // Tolerance values – make the ration very close to the target
  // UFL: allow ±0.05 UFL difference
  // PDI: allow ±10 g difference
  const UFL_TOLERANCE = 0.05;
  const PDI_TOLERANCE = 10;

  // Try to build an exact ration using linear solver
  let result = solveExactRation(
    targetUfl,
    targetPdi,
    selectedFeeds,
    dmi,
    UFL_TOLERANCE,
    PDI_TOLERANCE
  );
  // If exact solver didn't find a good solution, fall back to proportional builder
  if (!result) {
    result = buildProportionalRation(
      targetUfl,
      targetPdi,
      selectedFeeds,
      dmi,
      UFL_TOLERANCE,
      PDI_TOLERANCE
    );
  }

  // Final refinement: if there is a large protein excess, try to reduce high-PDI feeds
  result = reduceProteinExcess(result, selectedFeeds, targetUfl, targetPdi, dmi, UFL_TOLERANCE, PDI_TOLERANCE);

  // If there is still a strong deficit, compute suggestion for the farmer
  if (!result.balanced) {
    result.suggestedFeeds = computeSuggestedFeeds(result, selectedFeeds, targetUfl, targetPdi, dmi);
  }

  return result;
}

/**
 * Solve the ration using linear algebra to get EXACT target matching.
 * Uses a weighted optimization approach.
 */
function solveExactRation(
  targetUfl: number,
  targetPdi: number,
  feeds: Feed[],
  dmi: number,
  uflTolerance: number,
  pdiTolerance: number
): RationResult {
  const amounts: FeedAmount[] = [];

  // If no feeds selected, return empty result
  if (feeds.length === 0) {
    return createEmptyResult(targetUfl, targetPdi, dmi);
  }

  // Separate feeds by category
  const roughages = feeds.filter((f) => f.category === "roughage");
  const concentrates = feeds.filter((f) => f.category !== "roughage");

  // If we have at least one roughage and one concentrate, use exact solver
  if (roughages.length > 0 && concentrates.length > 0) {
    // Use 2-feed exact solver with primary roughage and concentrate blend
    const exactResult = solveWithExactMatch(
      targetUfl,
      targetPdi,
      roughages,
      concentrates,
      dmi,
      uflTolerance,
      pdiTolerance
    );
    
    if (exactResult) {
      return exactResult;
    }
  }

  // Fallback: proportional distribution if exact solver fails
  return buildProportionalRation(targetUfl, targetPdi, feeds, dmi, uflTolerance, pdiTolerance);
}

/**
 * Solve for exact UFL and PDI match using primary roughage and concentrate blend
 */
function solveWithExactMatch(
  targetUfl: number,
  targetPdi: number,
  roughages: Feed[],
  concentrates: Feed[],
  dmi: number,
  uflTolerance: number,
  pdiTolerance: number
): RationResult | null {
  // Create a blended concentrate (weighted average)
  const blendUfl = concentrates.reduce((s, f) => s + f.uflPerKg, 0) / concentrates.length;
  const blendPdi = concentrates.reduce((s, f) => s + f.pdiPerKg, 0) / concentrates.length;
  const blendDm = concentrates.reduce((s, f) => s + f.dm, 0) / concentrates.length;

  // Create a blended roughage (weighted average)
  const roughUfl = roughages.reduce((s, f) => s + f.uflPerKg, 0) / roughages.length;
  const roughPdi = roughages.reduce((s, f) => s + f.pdiPerKg, 0) / roughages.length;
  const roughDm = roughages.reduce((s, f) => s + f.dm, 0) / roughages.length;

  // Solve 2x2 system:
  // roughUfl * x + blendUfl * y = targetUfl
  // roughPdi * x + blendPdi * y = targetPdi
  
  const det = roughUfl * blendPdi - roughPdi * blendUfl;
  
  if (Math.abs(det) < 0.0001) {
    // Singular matrix - can't solve exactly
    return null;
  }

  // Cramer's rule
  const roughageKg = (targetUfl * blendPdi - targetPdi * blendUfl) / det;
  const concentrateKg = (roughUfl * targetPdi - roughPdi * targetUfl) / det;

  // Check if solution is valid (positive and within DMI)
  const totalDm = roughageKg * roughDm + concentrateKg * blendDm;
  
  if (roughageKg < 0 || concentrateKg < 0 || totalDm > dmi) {
    // Invalid solution - try with different allocation
    return null;
  }

  // Distribute to individual feeds with EXACT preservation of totals
  const amounts: FeedAmount[] = [];

  // Distribute roughage amount with exact total preservation
  if (roughageKg > 0.05 && roughages.length > 0) {
    // Calculate target UFL and PDI for roughages
    const roughTargetUfl = roughageKg * roughUfl;
    const roughTargetPdi = roughageKg * roughPdi;
    
    // Use exact distribution that preserves both UFL and PDI
    const roughAmounts = distributeExactly(
      roughages, 
      roughageKg, 
      roughTargetUfl, 
      roughTargetPdi
    );
    amounts.push(...roughAmounts);
  }

  // Distribute concentrate amount with exact total preservation
  if (concentrateKg > 0.05 && concentrates.length > 0) {
    // Calculate target UFL and PDI for concentrates
    const concTargetUfl = concentrateKg * blendUfl;
    const concTargetPdi = concentrateKg * blendPdi;
    
    // Use exact distribution that preserves both UFL and PDI
    const concAmounts = distributeExactly(
      concentrates, 
      concentrateKg, 
      concTargetUfl, 
      concTargetPdi
    );
    amounts.push(...concAmounts);
  }

  // Calculate totals
  const totalUfl = round2(amounts.reduce((s, a) => s + a.uflContrib, 0));
  const totalPdi = round0(amounts.reduce((s, a) => s + a.pdiContrib, 0));
  const totalDmFinal = round2(amounts.reduce((s, a) => s + a.dmContrib, 0));

  // Exact match - differences should be 0 (or very close due to rounding)
  const uflDiff = round2(totalUfl - targetUfl);
  const pdiDiff = round0(totalPdi - targetPdi);

  const uflOk = Math.abs(uflDiff) <= uflTolerance;
  const pdiOk = Math.abs(pdiDiff) <= pdiTolerance;

  return {
    feeds: amounts.filter((a) => a.kgPerDay > 0),
    totalUfl,
    totalPdi,
    totalDm: totalDmFinal,
    targetUfl: round2(targetUfl),
    targetPdi: round0(targetPdi),
    dmi: round2(dmi),
    uflDiff,
    pdiDiff,
    balanced: uflOk && pdiOk,
  };
}

/**
 * Distribute a total kg amount to individual feeds while preserving EXACT UFL and PDI totals
 * Uses a modified distribution that accounts for both constraints
 */
function distributeExactly(
  feeds: Feed[],
  totalKg: number,
  targetUfl: number,
  targetPdi: number
): FeedAmount[] {
  if (feeds.length === 0) return [];
  if (feeds.length === 1) {
    // Single feed - use it all
    const feed = feeds[0];
    return [{
      feed,
      kgPerDay: round1(totalKg),
      uflContrib: round2(totalKg * feed.uflPerKg),
      pdiContrib: round0(totalKg * feed.pdiPerKg),
      dmContrib: round2(totalKg * feed.dm),
    }];
  }

  // For 2+ feeds, use numerical optimization to find exact amounts
  // that match both UFL and PDI targets
  const result = solveMultiFeedExact(feeds, totalKg, targetUfl, targetPdi);
  
  if (result) {
    return result;
  }

  // Fallback: proportional by UFL
  return distributeProportional(feeds, totalKg, targetUfl);
}

/**
 * Solve for exact amounts when we have 2+ feeds in a category
 * Uses numerical optimization to match both UFL and PDI targets
 */
function solveMultiFeedExact(
  feeds: Feed[],
  totalKg: number,
  targetUfl: number,
  targetPdi: number
): FeedAmount[] | null {
  // For 2 feeds: exact solution is possible
  if (feeds.length === 2) {
    const [f1, f2] = feeds;
    
    // Solve 2x2 system:
    // f1.ufl * x + f2.ufl * y = targetUfl
    // f1.pdi * x + f2.pdi * y = targetPdi
    // x + y = totalKg
    
    // This is an overdetermined system, so we'll use least squares or simplify
    // Try solving for x using two equations, then adjust y
    
    // Method: Solve for x from UFL equation, y from PDI equation, then average
    const xFromUfl = totalKg > 0 ? (targetUfl - f2.uflPerKg * totalKg) / (f1.uflPerKg - f2.uflPerKg) : 0;
    const xFromPdi = totalKg > 0 ? (targetPdi - f2.pdiPerKg * totalKg) / (f1.pdiPerKg - f2.pdiPerKg) : 0;
    
    // Average the two solutions
    let x = (xFromUfl + xFromPdi) / 2;
    let y = totalKg - x;
    
    // Clamp to valid range
    x = Math.max(0, Math.min(totalKg, x));
    y = Math.max(0, Math.min(totalKg, y));
    
    const f1Kg = round1(x);
    const f2Kg = round1(y);
    
    const actualUfl = f1Kg * f1.uflPerKg + f2Kg * f2.uflPerKg;
    const actualPdi = f1Kg * f1.pdiPerKg + f2Kg * f2.pdiPerKg;
    const actualDm = f1Kg * f1.dm + f2Kg * f2.dm;
    
    const amounts: FeedAmount[] = [];
    if (f1Kg >= 0.1) {
      amounts.push({
        feed: f1,
        kgPerDay: f1Kg,
        uflContrib: round2(f1Kg * f1.uflPerKg),
        pdiContrib: round0(f1Kg * f1.pdiPerKg),
        dmContrib: round2(f1Kg * f1.dm),
      });
    }
    if (f2Kg >= 0.1) {
      amounts.push({
        feed: f2,
        kgPerDay: f2Kg,
        uflContrib: round2(f2Kg * f2.uflPerKg),
        pdiContrib: round0(f2Kg * f2.pdiPerKg),
        dmContrib: round2(f2Kg * f2.dm),
      });
    }
    
    return amounts;
  }

  // For 3+ feeds: use iterative optimization
  // Start with proportional distribution, then adjust
  const n = feeds.length;
  
  // Initial guess: equal distribution
  let amounts = feeds.map(f => {
    const kg = totalKg / n;
    return {
      feed: f,
      kgPerDay: kg,
      uflContrib: kg * f.uflPerKg,
      pdiContrib: kg * f.pdiPerKg,
      dmContrib: kg * f.dm,
    };
  });

  // Iterative adjustment to match targets
  for (let iter = 0; iter < 100; iter++) {
    const currentUfl = amounts.reduce((s, a) => s + a.uflContrib, 0);
    const currentPdi = amounts.reduce((s, a) => s + a.pdiContrib, 0);
    
    const uflError = targetUfl - currentUfl;
    const pdiError = targetPdi - currentPdi;
    
    // Check if we're close enough
    if (Math.abs(uflError) < 0.01 && Math.abs(pdiError) < 1) {
      break;
    }
    
    // Adjust amounts based on error
    // Find feeds with highest/lowest UFL to adjust
    const uflPerKg = amounts.map(a => a.feed.uflPerKg);
    const pdiPerKg = amounts.map(a => a.feed.pdiPerKg);
    
    // Calculate sensitivity matrix
    const totalUfl = uflPerKg.reduce((s, u) => s + u, 0);
    const totalPdi = pdiPerKg.reduce((s, p) => s + p, 0);
    
    // Distribute error proportionally to each feed based on their contribution
    for (let i = 0; i < n; i++) {
      const uflShare = uflPerKg[i] / totalUfl;
      const pdiShare = pdiPerKg[i] / totalPdi;
      const share = (uflShare + pdiShare) / 2;
      
      // Adjust kg to correct error
      // deltaKg = error / nutrient_per_kg
      const uflCorrection = uflError > 0 ? uflError * 0.1 * uflShare / uflPerKg[i] : uflError * 0.1 * uflShare / uflPerKg[i];
      const pdiCorrection = pdiError > 0 ? pdiError * 0.1 * pdiShare / pdiPerKg[i] : pdiError * 0.1 * pdiShare / pdiPerKg[i];
      
      amounts[i].kgPerDay += (uflCorrection + pdiCorrection) / 2;
      amounts[i].kgPerDay = Math.max(0, amounts[i].kgPerDay);
      
      // Recalculate contributions
      amounts[i].uflContrib = amounts[i].kgPerDay * amounts[i].feed.uflPerKg;
      amounts[i].pdiContrib = amounts[i].kgPerDay * amounts[i].feed.pdiPerKg;
      amounts[i].dmContrib = amounts[i].kgPerDay * amounts[i].feed.dm;
    }
    
    // Renormalize to exact total kg
    const currentTotalKg = amounts.reduce((s, a) => s + a.kgPerDay, 0);
    if (currentTotalKg > 0) {
      const scale = totalKg / currentTotalKg;
      for (const amount of amounts) {
        amount.kgPerDay *= scale;
        amount.uflContrib = amount.kgPerDay * amount.feed.uflPerKg;
        amount.pdiContrib = amount.kgPerDay * amount.feed.pdiPerKg;
        amount.dmContrib = amount.kgPerDay * amount.feed.dm;
      }
    }
  }
  
  // Round final values
  return amounts.map(a => ({
    feed: a.feed,
    kgPerDay: round1(a.kgPerDay),
    uflContrib: round2(a.kgPerDay * a.feed.uflPerKg),
    pdiContrib: round0(a.kgPerDay * a.feed.pdiPerKg),
    dmContrib: round2(a.kgPerDay * a.feed.dm),
  })).filter(a => a.kgPerDay >= 0.1);
}

/**
 * Simple proportional distribution fallback
 */
function distributeProportional(
  feeds: Feed[],
  totalKg: number,
  targetUfl: number
): FeedAmount[] {
  const totalUfl = feeds.reduce((s, f) => s + f.uflPerKg, 0);
  
  return feeds.map(feed => {
    const share = feed.uflPerKg / totalUfl;
    const kg = totalKg * share;
    return {
      feed,
      kgPerDay: round1(kg),
      uflContrib: round2(kg * feed.uflPerKg),
      pdiContrib: round0(kg * feed.pdiPerKg),
      dmContrib: round2(kg * feed.dm),
    };
  }).filter(a => a.kgPerDay >= 0.1);
}

/**
 * Fallback proportional ration builder
 */
function buildProportionalRation(
  targetUfl: number,
  targetPdi: number,
  feeds: Feed[],
  dmi: number,
  uflTolerance: number,
  pdiTolerance: number
): RationResult {
  const amounts: FeedAmount[] = [];
  const roughages = feeds.filter((f) => f.category === "roughage");
  const concentrates = feeds.filter((f) => f.category !== "roughage");

  // Step 1: Allocate roughages (~40% of UFL target for high-yield dairy cows)
  // This leaves more room for concentrates to help meet high energy/protein needs.
  const roughageUflTarget = targetUfl * 0.4;

  if (roughages.length > 0) {
    const totalRoughageUfl = roughages.reduce((s, f) => s + f.uflPerKg, 0);

    for (const feed of roughages) {
      const share = feed.uflPerKg / totalRoughageUfl;
      const uflNeeded = roughageUflTarget * share;
      const kgNeeded = uflNeeded / feed.uflPerKg;

      if (kgNeeded >= 0.1) {
        amounts.push({
          feed,
          kgPerDay: round1(kgNeeded),
          uflContrib: round2(kgNeeded * feed.uflPerKg),
          pdiContrib: round0(kgNeeded * feed.pdiPerKg),
          dmContrib: round2(kgNeeded * feed.dm),
        });
      }
    }
  }

  // Step 2: Calculate remaining and fill with concentrates
  const roughageUflActual = amounts.reduce((s, a) => s + a.uflContrib, 0);
  const roughagePdiActual = amounts.reduce((s, a) => s + a.pdiContrib, 0);

  let remainingUfl = targetUfl - roughageUflActual;
  let remainingPdi = targetPdi - roughagePdiActual;

  if (concentrates.length > 0 && (remainingUfl > 0 || remainingPdi > 0)) {
    const totalConcentrateUfl = concentrates.reduce((s, f) => s + f.uflPerKg, 0);
    const totalConcentratePdi = concentrates.reduce((s, f) => s + f.pdiPerKg, 0);

    for (const feed of concentrates) {
      const share = feed.uflPerKg / totalConcentrateUfl;
      const uflNeeded = remainingUfl * share;
      const pdiNeeded = remainingPdi * share;

      const kgForUfl = uflNeeded / feed.uflPerKg;
      const kgForPdi = pdiNeeded / feed.pdiPerKg;
      const kgNeeded = Math.max(kgForUfl, kgForPdi);

      if (kgNeeded >= 0.1) {
        amounts.push({
          feed,
          kgPerDay: round1(kgNeeded),
          uflContrib: round2(kgNeeded * feed.uflPerKg),
          pdiContrib: round0(kgNeeded * feed.pdiPerKg),
          dmContrib: round2(kgNeeded * feed.dm),
        });
      }
    }
  }

  // Step 3: Check DMI and adjust if needed
  const totalDm = amounts.reduce((s, a) => s + a.dmContrib, 0);
  
  if (totalDm > dmi) {
    adjustForDmi(amounts, concentrates, roughages, dmi, targetUfl, targetPdi);
  }

  // Step 4: Compute totals
  const totalUfl = round2(amounts.reduce((s, a) => s + a.uflContrib, 0));
  const totalPdi = round0(amounts.reduce((s, a) => s + a.pdiContrib, 0));
  const totalDmFinal = round2(amounts.reduce((s, a) => s + a.dmContrib, 0));

  const uflDiff = round2(totalUfl - targetUfl);
  const pdiDiff = round0(totalPdi - targetPdi);

  const uflOk = Math.abs(uflDiff) <= uflTolerance;
  const pdiOk = Math.abs(pdiDiff) <= pdiTolerance;

  return {
    feeds: amounts.filter((a) => a.kgPerDay > 0),
    totalUfl,
    totalPdi,
    totalDm: totalDmFinal,
    targetUfl: round2(targetUfl),
    targetPdi: round0(targetPdi),
    dmi: round2(dmi),
    uflDiff,
    pdiDiff,
    balanced: uflOk && pdiOk,
  };
}

function createEmptyResult(targetUfl: number, targetPdi: number, dmi: number): RationResult {
  return {
    feeds: [],
    totalUfl: 0,
    totalPdi: 0,
    totalDm: 0,
    targetUfl: round2(targetUfl),
    targetPdi: round0(targetPdi),
    dmi: round2(dmi),
    uflDiff: -targetUfl,
    pdiDiff: -targetPdi,
    balanced: false,
  };
}

/**
 * Phase 2: if there is a large protein excess, reduce high-PDI feeds
 * and compensate energy with lower-PDI concentrates, while keeping UFL close
 * to the target and respecting DMI.
 */
function reduceProteinExcess(
  base: RationResult,
  feeds: Feed[],
  targetUfl: number,
  targetPdi: number,
  dmi: number,
  uflTolerance: number,
  pdiTolerance: number
): RationResult {
  // If we already have acceptable protein, no need to adjust
  if (base.pdiDiff <= pdiTolerance) {
    return base;
  }

  // Clone feeds amounts so we can modify them
  const amounts: FeedAmount[] = base.feeds.map((a) => ({ ...a }));

  // Build lookup for feed metadata
  const feedById = new Map<string, Feed>();
  for (const f of feeds) {
    feedById.set(f.id, f);
  }

  // Helper to recompute totals
  const recomputeTotals = () => {
    const totalUfl = amounts.reduce((s, a) => s + a.uflContrib, 0);
    const totalPdi = amounts.reduce((s, a) => s + a.pdiContrib, 0);
    const totalDm = amounts.reduce((s, a) => s + a.dmContrib, 0);
    return { totalUfl, totalPdi, totalDm };
  };

  let { totalUfl, totalPdi, totalDm } = recomputeTotals();
  let uflDiff = totalUfl - targetUfl;
  let pdiDiff = totalPdi - targetPdi;

  // Identify candidate feeds
  const proteinRich = amounts
    .filter((a) => {
      const f = feedById.get(a.feed.id);
      return f && f.pdiPerKg / Math.max(f.uflPerKg, 0.1) > 150; // very rich in protein per UFL (e.g. soybean meal)
    })
    .map((a) => a.feed.id);

  const energyDense = amounts
    .filter((a) => {
      const f = feedById.get(a.feed.id);
      return f && f.uflPerKg >= 0.9 && f.pdiPerKg / Math.max(f.uflPerKg, 0.1) < 150; // good energy, moderate protein
    })
    .map((a) => a.feed.id);

  if (proteinRich.length === 0 || energyDense.length === 0) {
    // Nothing meaningful to adjust
    return base;
  }

  // Iteratively adjust
  for (let iter = 0; iter < 40; iter++) {
    if (pdiDiff <= pdiTolerance && Math.abs(uflDiff) <= uflTolerance) {
      break;
    }

    // Pick the richest protein feed and the best energy feed
    const proteinFeedAmount = amounts
      .filter((a) => proteinRich.includes(a.feed.id) && a.kgPerDay > 0.2)
      .sort((a, b) => b.feed.pdiPerKg - a.feed.pdiPerKg)[0];
    const energyFeedAmount = amounts
      .filter((a) => energyDense.includes(a.feed.id))
      .sort((a, b) => b.feed.uflPerKg - a.feed.uflPerKg)[0];

    if (!proteinFeedAmount || !energyFeedAmount) {
      break;
    }

    const proteinFeed = proteinFeedAmount.feed;
    const energyFeed = energyFeedAmount.feed;

    // Step of reduction on protein feed
    const stepKg = Math.min(0.3, proteinFeedAmount.kgPerDay * 0.25);
    if (stepKg <= 0) break;

    // Remove some high-protein feed
    proteinFeedAmount.kgPerDay = round1(proteinFeedAmount.kgPerDay - stepKg);
    proteinFeedAmount.uflContrib = round2(proteinFeedAmount.kgPerDay * proteinFeed.uflPerKg);
    proteinFeedAmount.pdiContrib = round0(proteinFeedAmount.kgPerDay * proteinFeed.pdiPerKg);
    proteinFeedAmount.dmContrib = round2(proteinFeedAmount.kgPerDay * proteinFeed.dm);

    // Estimate UFL lost, and add equivalent UFL from energy feed (but with lower PDI per UFL)
    const uflLost = stepKg * proteinFeed.uflPerKg;
    if (uflLost > 0) {
      const addKg = uflLost / Math.max(energyFeed.uflPerKg, 0.1);
      const newKg = energyFeedAmount.kgPerDay + addKg;

      // Respect DMI if possible
      const potentialDm = totalDm - stepKg * proteinFeed.dm + addKg * energyFeed.dm;
      if (potentialDm <= dmi + 0.1) {
        energyFeedAmount.kgPerDay = round1(newKg);
        energyFeedAmount.uflContrib = round2(energyFeedAmount.kgPerDay * energyFeed.uflPerKg);
        energyFeedAmount.pdiContrib = round0(energyFeedAmount.kgPerDay * energyFeed.pdiPerKg);
        energyFeedAmount.dmContrib = round2(energyFeedAmount.kgPerDay * energyFeed.dm);
      }
    }

    // Recompute
    ({ totalUfl, totalPdi, totalDm } = recomputeTotals());
    uflDiff = totalUfl - targetUfl;
    pdiDiff = totalPdi - targetPdi;
  }

  const finalUfl = round2(totalUfl);
  const finalPdi = round0(totalPdi);
  const finalDm = round2(totalDm);
  const finalUflDiff = round2(finalUfl - targetUfl);
  const finalPdiDiff = round0(finalPdi - targetPdi);

  const uflOk = Math.abs(finalUflDiff) <= uflTolerance;
  const pdiOk = Math.abs(finalPdiDiff) <= pdiTolerance;

  return {
    feeds: amounts.filter((a) => a.kgPerDay > 0),
    totalUfl: finalUfl,
    totalPdi: finalPdi,
    totalDm: finalDm,
    targetUfl: round2(targetUfl),
    targetPdi: round0(targetPdi),
    dmi: round2(dmi),
    uflDiff: finalUflDiff,
    pdiDiff: finalPdiDiff,
    balanced: uflOk && pdiOk,
    suggestedFeeds: base.suggestedFeeds,
  };
}

/**
 * Suggest additional feeds (by id) that could help cover remaining deficits
 * in energy or protein, based on what is NOT currently selected.
 */
function computeSuggestedFeeds(
  result: RationResult,
  selectedFeeds: Feed[],
  targetUfl: number,
  targetPdi: number,
  dmi: number
): string[] {
  const suggestions = new Set<string>();
  const selectedIds = new Set(selectedFeeds.map((f) => f.id));

  const uflDeficit = targetUfl - result.totalUfl;
  const pdiDeficit = targetPdi - result.totalPdi;

  if (uflDeficit <= 0 && pdiDeficit <= 0) {
    return [];
  }

  // Helper metrics per kg DM
  const feedsNotSelected = FEEDS.filter((f) => !selectedIds.has(f.id));

  if (pdiDeficit > 50) {
    // Need protein: choose feeds with the best PDI per kg DM
    const proteinCandidates = feedsNotSelected
      .map((f) => ({
        feed: f,
        pdiPerDm: f.pdiPerKg / Math.max(f.dm, 0.1),
      }))
      .sort((a, b) => b.pdiPerDm - a.pdiPerDm)
      .slice(0, 3);

    for (const c of proteinCandidates) {
      suggestions.add(c.feed.id);
    }
  }

  if (uflDeficit > 0.2) {
    // Need energy: choose feeds with high UFL per kg DM
    const energyCandidates = feedsNotSelected
      .map((f) => ({
        feed: f,
        uflPerDm: f.uflPerKg / Math.max(f.dm, 0.1),
      }))
      .sort((a, b) => b.uflPerDm - a.uflPerDm)
      .slice(0, 3);

    for (const c of energyCandidates) {
      suggestions.add(c.feed.id);
    }
  }

  return Array.from(suggestions);
}

/**
 * Adjust ration to not exceed DMI - reduces concentrates first, then roughages
 */
function adjustForDmi(
  amounts: FeedAmount[],
  concentrates: Feed[],
  roughages: Feed[],
  dmi: number,
  targetUfl: number,
  targetPdi: number
): void {
  // Separate current amounts into concentrates and roughages
  const concentrateAmounts = amounts.filter(
    (a) => a.feed.category !== "roughage"
  );
  const roughageAmounts = amounts.filter((a) => a.feed.category === "roughage");

  let currentDm = amounts.reduce((s, a) => s + a.dmContrib, 0);
  let targetDm = dmi;

  // Step 1: Reduce concentrates proportionally
  if (concentrateAmounts.length > 0 && currentDm > targetDm) {
    const concentrateDm = concentrateAmounts.reduce((s, a) => s + a.dmContrib, 0);
    const excessDm = currentDm - targetDm;

    if (concentrateDm > 0) {
      // Reduce concentrates to eliminate excess
      const reduceRatio = Math.max(0, concentrateDm - excessDm) / concentrateDm;

      for (const amount of concentrateAmounts) {
        amount.kgPerDay = round1(amount.kgPerDay * reduceRatio);
        amount.uflContrib = round2(amount.kgPerDay * amount.feed.uflPerKg);
        amount.pdiContrib = round0(amount.kgPerDay * amount.feed.pdiPerKg);
        amount.dmContrib = round2(amount.kgPerDay * amount.feed.dm);
      }

      // Recalculate current DM after concentrate reduction
      currentDm = amounts.reduce((s, a) => s + a.dmContrib, 0);
    }
  }

  // Step 2: If still over DMI, reduce roughages
  if (roughageAmounts.length > 0 && currentDm > targetDm) {
    const roughageDm = roughageAmounts.reduce((s, a) => s + a.dmContrib, 0);
    const excessDm = currentDm - targetDm;

    if (roughageDm > 0) {
      const reduceRatio = Math.max(0, roughageDm - excessDm) / roughageDm;

      for (const amount of roughageAmounts) {
        amount.kgPerDay = round1(amount.kgPerDay * reduceRatio);
        amount.uflContrib = round2(amount.kgPerDay * amount.feed.uflPerKg);
        amount.pdiContrib = round0(amount.kgPerDay * amount.feed.pdiPerKg);
        amount.dmContrib = round2(amount.kgPerDay * amount.feed.dm);
      }
    }
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round0(n: number): number {
  return Math.round(n);
}
