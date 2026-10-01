import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_LANG } from "~/shared/domain";

// « / » renvoie vers la langue par défaut (anglais) ; le sélecteur de langue propose le français et le portugais.
export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: () => new Response(null, { status: 302, headers: { Location: `/${DEFAULT_LANG}` } }),
    },
  },
});
