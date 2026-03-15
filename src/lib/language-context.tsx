"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translations, type Language, type Translations } from "./i18n";

export type { Language };

interface LanguageContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: Translations;
  dir: "rtl" | "ltr";
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const LANGUAGE_STORAGE_KEY = "inra_lang";

function normalizeLanguage(value: string | null): Language {
  return value === "ar" || value === "fr" || value === "en" ? value : "fr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Keep first render deterministic across SSR + hydration
  const [lang, setLang] = useState<Language>("fr");

  // Restore user preference after mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
    const raf = requestAnimationFrame(() => {
      setLang(saved);
    });

    return () => cancelAnimationFrame(raf);
  }, []);

  // Persist latest user choice
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, [lang]);

  const value: LanguageContextValue = useMemo(
    () => ({
      lang,
      setLang,
      t: translations[lang],
      dir: lang === "ar" ? "rtl" : "ltr",
    }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  ar: "العربية",
  fr: "Français",
  en: "English",
};
