"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
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
const LANGUAGE_CHANGE_EVENT = "inra-language-change";

function normalizeLanguage(value: string | null): Language {
  return value === "ar" || value === "fr" || value === "en" ? value : "fr";
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(LANGUAGE_CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, handler);
  };
}

function getClientLanguageSnapshot(): Language {
  if (typeof window === "undefined") {
    return "fr";
  }

  return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

function getServerLanguageSnapshot(): Language {
  return "fr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, getClientLanguageSnapshot, getServerLanguageSnapshot);

  const setLang = (nextLang: Language) => {
    if (typeof window === "undefined") return;

    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
    window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const value: LanguageContextValue = {
    lang,
    setLang,
    t: translations[lang],
    dir: lang === "ar" ? "rtl" : "ltr",
  };

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
