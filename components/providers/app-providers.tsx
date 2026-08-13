"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "pt" | "fr" | "en";

const messages = {
  pt: {
    "nav.how": "Como funciona", "nav.about": "Sobre nós", "nav.companies": "Empresas", "nav.rental": "Aluguer", "nav.sale": "Venda",
    "controls.language": "Idioma", "controls.themeLight": "Ativar tema claro", "controls.themeDark": "Ativar tema escuro", "menu.open": "Abrir menu", "menu.close": "Fechar menu",
  },
  fr: {
    "nav.how": "Comment ça marche", "nav.about": "À propos", "nav.companies": "Entreprises", "nav.rental": "Location", "nav.sale": "Vente",
    "controls.language": "Langue", "controls.themeLight": "Activer le thème clair", "controls.themeDark": "Activer le thème sombre", "menu.open": "Ouvrir le menu", "menu.close": "Fermer le menu",
  },
  en: {
    "nav.how": "How it works", "nav.about": "About", "nav.companies": "Companies", "nav.rental": "Rental", "nav.sale": "For sale",
    "controls.language": "Language", "controls.themeLight": "Use light theme", "controls.themeDark": "Use dark theme", "menu.open": "Open menu", "menu.close": "Close menu",
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
  useEffect(() => { document.documentElement.dataset.theme = "light"; localStorage.removeItem("agrotruck-theme"); }, []);

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
