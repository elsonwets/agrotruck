"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "pt" | "fr" | "en";

const messages = {
  pt: {
    "nav.how": "Como funciona", "nav.about": "Sobre nós", "nav.partner": "Espaço parceiro", "nav.rental": "Aluguer", "nav.sale": "Venda",
    "controls.language": "Idioma", "menu.open": "Abrir menu", "menu.close": "Fechar menu",
  },
  fr: {
    "nav.how": "Comment ça marche", "nav.about": "À propos", "nav.partner": "Espace partenaire", "nav.rental": "Location", "nav.sale": "Vente",
    "controls.language": "Langue", "menu.open": "Ouvrir le menu", "menu.close": "Fermer le menu",
  },
  en: {
    "nav.how": "How it works", "nav.about": "About", "nav.partner": "Partner area", "nav.rental": "Rental", "nav.sale": "For sale",
    "controls.language": "Language", "menu.open": "Open menu", "menu.close": "Close menu",
  },
} as const;

type MessageKey = keyof typeof messages.pt;
type AppContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: MessageKey) => string };
const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("pt");
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    const savedLanguage = localStorage.getItem("agrotruck-language");
    queueMicrotask(() => {
      if (savedLanguage === "pt" || savedLanguage === "fr" || savedLanguage === "en") setLanguageState(savedLanguage);
      setSettingsReady(true);
    });
  }, []);
  useEffect(() => { document.documentElement.lang = language; if (settingsReady) localStorage.setItem("agrotruck-language", language); }, [language, settingsReady]);

  const value = useMemo<AppContextValue>(() => ({
    language,
    setLanguage: setLanguageState,
    t: (key) => messages[language][key],
  }), [language]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppSettings() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useAppSettings doit être utilisé dans AppProviders");
  return value;
}
