import { createFileRoute } from "@tanstack/react-router";
import { negotiateLang } from "~/i18n";

// « / » renvoie vers la langue du visiteur (en-tête Accept-Language), portugais par défaut.
export const Route = createFileRoute("/")({
  server: {
    handlers: {
      GET: ({ request }) => new Response(null, {
        status: 302,
        headers: { Location: `/${negotiateLang(request.headers.get("accept-language"))}`, Vary: "Accept-Language" },
      }),
    },
  },
});
