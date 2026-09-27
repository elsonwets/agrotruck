import { createFileRoute } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";

// Page servie par le service worker quand une page demandée n'est pas encore disponible hors ligne.
export const Route = createFileRoute("/$lang/offline")({
  head: ({ params }) => privateHead(params.lang),
  component: OfflinePage,
});

function OfflinePage() {
  const t = useT();
  return <section className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
    <div className="max-w-md">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-brand-50 text-brand-800"><WifiOff className="size-7" aria-hidden="true" /></span>
      <h1 className="mt-6 text-2xl font-bold">{t.offline.pageTitle}</h1>
      <p className="mt-3 text-muted">{t.offline.pageText}</p>
      <Button className="mt-8" onClick={() => window.location.reload()}>{t.offline.retry}</Button>
    </div>
  </section>;
}
