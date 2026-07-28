"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "pt" | "fr" | "en";
type Theme = "light" | "dark";

const messages = {
  pt: {
    "nav.home": "Início", "nav.trucks": "Encontrar camião", "nav.publish": "Publicar camião", "nav.how": "Como funciona", "nav.about": "Sobre nós", "nav.companies": "Empresas", "nav.pricing": "Preços",
    "auth.signin": "Entrar", "auth.register": "Cadastrar camião", "auth.dashboard": "Dashboard",
    "hero.badge": "Disponíveis perto de si • Contacto direto", "hero.title": "Encontre rapidamente um truck disponível.",
    "hero.subtitle": "A forma mais rápida de encontrar camiões disponíveis na Guiné-Bissau.", "hero.find": "Encontrar Truck", "hero.publish": "Cadastrar Truck",
    "search.formLabel": "Pesquisar trucks disponíveis", "search.location": "Localização", "search.material": "Mercadoria", "search.capacity": "Capacidade (t)", "search.availability": "Disponibilidade", "search.submit": "Pesquisar",
    "controls.language": "Idioma", "controls.themeLight": "Ativar tema claro", "controls.themeDark": "Ativar tema escuro", "menu.open": "Abrir menu", "menu.close": "Fechar menu",
  },
  fr: {
    "nav.home": "Accueil", "nav.trucks": "Trouver un camion", "nav.publish": "Publier un camion", "nav.how": "Comment ça marche", "nav.about": "À propos", "nav.companies": "Entreprises", "nav.pricing": "Tarifs",
    "auth.signin": "Se connecter", "auth.register": "Inscrire mon camion", "auth.dashboard": "Dashboard",
    "hero.badge": "Disponibles près de vous • Contact direct", "hero.title": "Trouvez rapidement un camion disponible.",
    "hero.subtitle": "La façon la plus rapide de trouver des camions disponibles en Guinée-Bissau.", "hero.find": "Trouver un camion", "hero.publish": "Inscrire un camion",
    "search.formLabel": "Rechercher des camions disponibles", "search.location": "Localisation", "search.material": "Marchandise", "search.capacity": "Capacité (t)", "search.availability": "Disponibilité", "search.submit": "Rechercher",
    "controls.language": "Langue", "controls.themeLight": "Activer le thème clair", "controls.themeDark": "Activer le thème sombre", "menu.open": "Ouvrir le menu", "menu.close": "Fermer le menu",
  },
  en: {
    "nav.home": "Home", "nav.trucks": "Find a truck", "nav.publish": "List a truck", "nav.how": "How it works", "nav.about": "About", "nav.companies": "Companies", "nav.pricing": "Pricing",
    "auth.signin": "Sign in", "auth.register": "Register my truck", "auth.dashboard": "Dashboard",
    "hero.badge": "Available near you • Direct contact", "hero.title": "Quickly find an available truck.",
    "hero.subtitle": "The fastest way to find available trucks in Guinea-Bissau.", "hero.find": "Find a truck", "hero.publish": "Register a truck",
    "search.formLabel": "Search available trucks", "search.location": "Location", "search.material": "Cargo", "search.capacity": "Capacity (t)", "search.availability": "Availability", "search.submit": "Search",
    "controls.language": "Language", "controls.themeLight": "Use light theme", "controls.themeDark": "Use dark theme", "menu.open": "Open menu", "menu.close": "Close menu",
  },
} as const;

type MessageKey = keyof typeof messages.pt;
type AppContextValue = { language: Language; setLanguage: (language: Language) => void; theme: Theme; toggleTheme: () => void; t: (key: MessageKey) => string };
const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("pt");
  const [theme, setTheme] = useState<Theme>("light");
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    const savedLanguage = localStorage.getItem("agrotruck-language");
    const savedTheme = localStorage.getItem("agrotruck-theme");
    queueMicrotask(() => {
      if (savedLanguage === "pt" || savedLanguage === "fr" || savedLanguage === "en") setLanguageState(savedLanguage);
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      setSettingsReady(true);
    });
  }, []);
  useEffect(() => { document.documentElement.lang = language; if (settingsReady) localStorage.setItem("agrotruck-language", language); }, [language, settingsReady]);
  useEffect(() => { document.documentElement.dataset.theme = theme; if (settingsReady) localStorage.setItem("agrotruck-theme", theme); }, [theme, settingsReady]);

  const value = useMemo<AppContextValue>(() => ({
    language,
    setLanguage: setLanguageState,
    theme,
    toggleTheme: () => setTheme((current) => current === "light" ? "dark" : "light"),
    t: (key) => messages[language][key],
  }), [language, theme]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppSettings() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useAppSettings doit être utilisé dans AppProviders");
  return value;
}
