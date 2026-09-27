import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "~/lib/seo";
import { LANGS } from "~/shared/domain";

const PRIVATE = ["producer", "transporter", "admin", "profile", "login", "offline"];

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => new Response(
        ["User-agent: *", "Allow: /", ...LANGS.flatMap((lang) => PRIVATE.map((path) => `Disallow: /${lang}/${path}`)), "", `Sitemap: ${SITE_URL}/sitemap.xml`, ""].join("\n"),
        { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } },
      ),
    },
  },
});
