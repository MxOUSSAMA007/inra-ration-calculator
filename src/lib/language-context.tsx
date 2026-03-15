"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window === "undefined") return "fr";
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    return saved === "ar" || saved === "fr" || saved === "en" ? saved : "fr";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, [lang]);


  const value: LanguageContextValue = {
    lang,
    setLang,
    t: translations[lang],
    dir: lang === "ar" ? "rtl" : "ltr",
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
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
