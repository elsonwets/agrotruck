"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SessionProvider } from "@/lib/use-session";

export type Language = "pt" | "fr" | "en";

const messages = {
  pt: {
    "nav.how": "Como funciona", "nav.about": "Sobre nós", "account.login": "Entrar", "account.signup": "Criar conta", "account.space": "O meu espaço", "account.profile": "O meu perfil", "account.logout": "Sair", "account.becomePartner": "Tornar-se parceiro", "account.menu": "Conta", "nav.rental": "Aluguer", "nav.sale": "Venda",
    "controls.language": "Idioma", "menu.open": "Abrir menu", "menu.close": "Fechar menu",
  },
  fr: {
    "nav.how": "Comment ça marche", "nav.about": "À propos", "account.login": "Se connecter", "account.signup": "Créer un compte", "account.space": "Mon espace", "account.profile": "Mon profil", "account.logout": "Se déconnecter", "account.becomePartner": "Devenir partenaire", "account.menu": "Compte", "nav.rental": "Location", "nav.sale": "Vente",
    "controls.language": "Langue", "menu.open": "Ouvrir le menu", "menu.close": "Fermer le menu",
  },
  en: {
    "nav.how": "How it works", "nav.about": "About", "account.login": "Log in", "account.signup": "Sign up", "account.space": "My space", "account.profile": "My profile", "account.logout": "Log out", "account.becomePartner": "Become a partner", "account.menu": "Account", "nav.rental": "Rental", "nav.sale": "For sale",
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

  return <AppContext.Provider value={value}><SessionProvider>{children}</SessionProvider></AppContext.Provider>;
}

export function useAppSettings() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useAppSettings doit être utilisé dans AppProviders");
  return value;
}
