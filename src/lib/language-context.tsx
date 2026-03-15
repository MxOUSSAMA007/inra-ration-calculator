"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
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
const LANGUAGE_EVENT = "inra-language-change";

function normalizeLanguage(value: string | null): Language {
  return value === "ar" || value === "fr" || value === "en" ? value : "fr";
}

function readLanguage(): Language {
  if (typeof window === "undefined") return "fr";
  return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

function subscribeLanguage(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY) {
      onStoreChange();
    }
  };

  const onCustomEvent = () => onStoreChange();

  window.addEventListener("storage", onStorage);
  window.addEventListener(LANGUAGE_EVENT, onCustomEvent);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LANGUAGE_EVENT, onCustomEvent);
  };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribeLanguage, readLanguage, () => "fr");

  const setLang = useCallback((next: Language) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  }, []);

  const value: LanguageContextValue = useMemo(
    () => ({
      lang,
      setLang,
      t: translations[lang],
      dir: lang === "ar" ? "rtl" : "ltr",
    }),
    [lang, setLang]
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
