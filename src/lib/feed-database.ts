/**
 * Feed Database — INRA nutritional values for common dairy cow feeds
 * Sources: INRA 2018 tables (Alimentation des bovins, ovins et caprins)
 *
 * UFL = Unité Fourragère Lait (energy unit per kg of dry matter)
 * PDI = Protéines Digestibles dans l'Intestin (g per kg of dry matter)
 * DM  = Dry Matter content (fraction, e.g. 0.88 = 88% DM)
 */

export type FeedCategory = "roughage" | "concentrate" | "byproduct";

export interface Feed {
  id: string;
  /** Display name (for blends) */
  name?: string;
  /** Dry matter fraction (0–1) */
  dm: number;
  /** UFL per kg of fresh weight */
  uflPerKg: number;
  /** PDI (g) per kg of fresh weight */
  pdiPerKg: number;
  /** PDIN (g) per kg of fresh weight */
  pdinPerKg?: number;
  /** PDIE (g) per kg of fresh weight */
  pdiePerKg?: number;
  category: FeedCategory;
  /** Typical max inclusion as fraction of total DM intake (0–1) */
  maxFraction: number;
}

/**
 * Common feeds available in North Africa / Maghreb farms.
 * Values are per kg of FRESH weight (as-fed basis).
 */
export const FEEDS: Feed[] = [
  // ── Roughages ──────────────────────────────────────────────────────────────
  {
    id: "hay",
    dm: 0.88,
    uflPerKg: 0.72,
    pdiPerKg: 55,
    pdinPerKg: 55,
    pdiePerKg: 45,
    category: "roughage",
    maxFraction: 1.0,
  },
  {
    id: "straw",
    dm: 0.88,
    uflPerKg: 0.40,
    pdiPerKg: 20,
    pdinPerKg: 18,
    pdiePerKg: 15,
    category: "roughage",
    maxFraction: 0.4,
  },
  {
    id: "grass_fresh",
    dm: 0.20,
    uflPerKg: 0.18,
    pdiPerKg: 16,
    pdinPerKg: 14,
    pdiePerKg: 14,
    category: "roughage",
    maxFraction: 1.0,
  },
  {
    id: "corn_silage",
    dm: 0.33,
    uflPerKg: 0.30,
    pdiPerKg: 18,
    pdinPerKg: 14,
    pdiePerKg: 18,
    category: "roughage",
    maxFraction: 0.6,
  },
  {
    id: "alfalfa_hay",
    dm: 0.88,
    uflPerKg: 0.78,
    pdiPerKg: 100,
    pdinPerKg: 100,
    pdiePerKg: 80,
    category: "roughage",
    maxFraction: 0.5,
  },
  {
    id: "alfalfa_fresh",
    dm: 0.22,
    uflPerKg: 0.19,
    pdiPerKg: 26,
    pdinPerKg: 26,
    pdiePerKg: 22,
    category: "roughage",
    maxFraction: 0.5,
  },
  {
    id: "sorghum_silage",
    dm: 0.30,
    uflPerKg: 0.27,
    pdiPerKg: 20,
    pdinPerKg: 16,
    pdiePerKg: 20,
    category: "roughage",
    maxFraction: 0.6,
  },
  {
    id: "oat_hay",
    dm: 0.88,
    uflPerKg: 0.65,
    pdiPerKg: 70,
    pdinPerKg: 70,
    pdiePerKg: 55,
    category: "roughage",
    maxFraction: 0.7,
  },
  // ── Concentrates ───────────────────────────────────────────────────────────
  {
    id: "barley",
    dm: 0.88,
    uflPerKg: 1.05,
    pdiPerKg: 80,
    pdinPerKg: 65,
    pdiePerKg: 80,
    category: "concentrate",
    maxFraction: 0.4,
  },
  {
    id: "corn_grain",
    dm: 0.88,
    uflPerKg: 1.12,
    pdiPerKg: 65,
    pdinPerKg: 50,
    pdiePerKg: 65,
    category: "concentrate",
    maxFraction: 0.4,
  },
  {
    id: "wheat_bran",
    dm: 0.88,
    uflPerKg: 0.85,
    pdiPerKg: 100,
    pdinPerKg: 90,
    pdiePerKg: 100,
    category: "byproduct",
    maxFraction: 0.2,
  },
  {
    id: "soybean_meal",
    dm: 0.88,
    uflPerKg: 1.05,
    pdiPerKg: 290,
    pdinPerKg: 290,
    pdiePerKg: 240,
    category: "concentrate",
    maxFraction: 0.15,
  },
  {
    id: "sunflower_meal",
    dm: 0.88,
    uflPerKg: 0.85,
    pdiPerKg: 200,
    pdinPerKg: 200,
    pdiePerKg: 160,
    category: "concentrate",
    maxFraction: 0.15,
  },
  {
    id: "sugar_beet_pulp",
    dm: 0.88,
    uflPerKg: 0.90,
    pdiPerKg: 70,
    pdinPerKg: 55,
    pdiePerKg: 70,
    category: "byproduct",
    maxFraction: 0.2,
  },
  {
    id: "cottonseed_meal",
    dm: 0.90,
    uflPerKg: 0.90,
    pdiPerKg: 230,
    pdinPerKg: 230,
    pdiePerKg: 190,
    category: "concentrate",
    maxFraction: 0.15,
  },
  {
    id: "rapeseed_meal",
    dm: 0.90,
    uflPerKg: 0.95,
    pdiPerKg: 210,
    pdinPerKg: 210,
    pdiePerKg: 175,
    category: "concentrate",
    maxFraction: 0.20,
  },
  {
    id: "molasses",
    dm: 0.75,
    uflPerKg: 0.80,
    pdiPerKg: 40,
    pdinPerKg: 30,
    pdiePerKg: 40,
    category: "byproduct",
    maxFraction: 0.10,
  },
  {
    id: "mixed_concentrate",
    name: "Dairy concentrate mix",
    dm: 0.88,
    uflPerKg: 1.05,
    pdiPerKg: 120,
    pdinPerKg: 105,
    pdiePerKg: 120,
    category: "concentrate",
    maxFraction: 0.4,
  },
];

/** Look up a feed by id */
export function getFeedById(id: string): Feed | undefined {
  return FEEDS.find((f) => f.id === id);
}
