import { useEffect } from "react";
import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { Footer } from "~/components/layout/footer";
import { Header } from "~/components/layout/header";
import { NotFound } from "~/components/not-found";
import { OfflineBanner } from "~/components/offline-banner";
import { useLang, useT } from "~/lib/i18n";
import { isLang } from "~/shared/domain";

// Toutes les pages sont sous /fr, /en ou /pt. Une autre valeur donne une page 404.
export const Route = createFileRoute("/$lang")({
  beforeLoad: ({ params }) => {
    if (!isLang(params.lang)) throw notFound();
  },
  component: LangLayout,
  notFoundComponent: NotFound,
});

function LangLayout() {
  const t = useT();
  const lang = useLang();
  useEffect(() => {
    // Service worker (hors ligne) en production seulement ; il met en cache les écrans de la langue choisie.
    if (import.meta.env.PROD && "serviceWorker" in navigator) navigator.serviceWorker.register(`/sw.js?lang=${lang}`, { scope: "/" }).catch(() => undefined);
  }, [lang]);
  return <>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">{t.nav.skipToContent}</a>
    <Header />
    <OfflineBanner />
    <main id="main" className="flex-1">
      <Outlet />
    </main>
    <Footer />
  </>;
}
