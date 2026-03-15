"use client";

import { useState } from "react";
import RationCalculator from "@/components/RationCalculator";
import DigitalCowPassport from "@/components/DigitalCowPassport";
import { useLanguage, LANGUAGE_LABELS, type Language } from "@/lib/language-context";

type ViewMode = "home" | "calculator" | "passport";

function LanguageSwitcher({ lang, setLang }: { lang: Language; setLang: (l: Language) => void }) {
  return (
    <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1">
      {(["ar", "fr", "en"] as Language[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
            lang === l
              ? "bg-emerald-500 text-white shadow"
              : "text-white/60 hover:text-white hover:bg-white/10"
          }`}
        >
          {LANGUAGE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const { lang, setLang, t } = useLanguage();
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  
  // Home Screen with Two Gates
  if (viewMode === "home") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-950 via-emerald-900 to-teal-900 flex flex-col items-center justify-center p-4">
        {/* Language Switcher */}
        <div className="absolute top-4 right-4">
           <LanguageSwitcher lang={lang} setLang={setLang} />
        </div>

        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            {t.homeTitle} 
          </h1>
          <p className="text-emerald-300 text-lg">
            {t.homeSubtitle}
          </p>
        </div>

        {/* Two Gates Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
          {/* Gate 1: INRA Calculator */}
          <button
            onClick={() => setViewMode("calculator")}
            className="group relative bg-gradient-to-br from-emerald-600/40 to-teal-600/40 border-2 border-emerald-400/50 rounded-3xl p-8 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/30 transition-all duration-300 transform hover:scale-105"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="text-7xl mb-2">🧮</div>
              <h2 className="text-2xl font-bold text-white">
                {t.calculatorCardTitle}
              </h2>
              <p className="text-emerald-200 text-sm leading-relaxed">
                  {t.calculatorCardDescriptionLine1}
                <br />
               {t.calculatorCardDescriptionLine2}
              </p>
              <div className="pt-4">
                <span className="inline-block px-6 py-2 bg-emerald-500 text-white rounded-full font-semibold text-sm group-hover:bg-emerald-400 transition-colors">
                  {t.openCalculator}
                </span>
              </div>
            </div>
          </button>

          {/* Gate 2: Digital Cow Passport */}
          <button
            onClick={() => setViewMode("passport")}
            className="group relative bg-gradient-to-br from-blue-600/40 to-indigo-600/40 border-2 border-blue-400/50 rounded-3xl p-8 hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-105"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="text-7xl mb-2">📋</div>
              <h2 className="text-2xl font-bold text-white">
                {t.passportCardTitle}
              </h2>
              <p className="text-blue-200 text-sm leading-relaxed">
                {t.passportCardDescriptionLine1}
                <br />
                {t.passportCardDescriptionLine2}
              </p>
              <div className="pt-4">
                <span className="inline-block px-6 py-2 bg-blue-500 text-white rounded-full font-semibold text-sm group-hover:bg-blue-400 transition-colors">
                  {t.openPassport}
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Footer */}
        <p className="mt-12 text-emerald-500/60 text-xs text-center max-w-md">
          {t.homeFooter}
        </p>
      </div>
    );
  }

  // Calculator Mode
  if (viewMode === "calculator") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-950 via-emerald-900 to-teal-900">
        {/* Back Button & Language */}
        <div className="w-full flex justify-between items-center p-4">
          <button
            onClick={() => setViewMode("home")}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-all"
          >
            {t.backToHome}
          </button>
          <LanguageSwitcher lang={lang} setLang={setLang} />
        </div>
        
        {/* Calculator */}
        <div className="container mx-auto px-4 pb-8">
          <RationCalculator />
        </div>
      </div>
    );
  }

  // Passport Mode
  if (viewMode === "passport") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-indigo-900 to-purple-900">
        {/* Back Button & Language */}
        <div className="w-full flex justify-between items-center p-4">
          <button
            onClick={() => setViewMode("home")}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-all"
          >
            {t.backToHome}
          </button>
          <LanguageSwitcher lang={lang} setLang={setLang} />
        </div>
        
        {/* Passport */}
        <div className="container mx-auto px-4 pb-8">
          <DigitalCowPassport />
        </div>
      </div>
    );
  }

  return null;
}
