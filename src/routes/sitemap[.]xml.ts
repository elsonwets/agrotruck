import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { SITE_URL } from "~/lib/seo";
import { LANGS } from "~/shared/domain";

const PUBLIC_PATHS = ["", "/rental", "/sale", "/fleet", "/how-it-works", "/pricing", "/about", "/signup"];

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Plan du site : chaque page publique dans les 3 langues (avec alternates hreflang) + chaque annonce visible.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        let trucks: { slug: string; updatedAt: number }[] = [];
        try {
          trucks = await new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL as string).query(api.trucks.sitemap, {});
        } catch { /* Convex indisponible : on publie au moins les pages fixes */ }
        const entries = [
          ...PUBLIC_PATHS.map((path) => ({ path, lastmod: undefined as string | undefined, priority: path === "" ? "1.0" : "0.7" })),
          ...trucks.map((truck) => ({ path: `/trucks/${truck.slug}`, lastmod: new Date(truck.updatedAt).toISOString().slice(0, 10), priority: "0.6" })),
        ];
        const urls = entries.flatMap(({ path, lastmod, priority }) => LANGS.map((lang) => [
          "<url>",
          `<loc>${escape(`${SITE_URL}/${lang}${path}`)}</loc>`,
          ...LANGS.map((other) => `<xhtml:link rel="alternate" hreflang="${other}" href="${escape(`${SITE_URL}/${other}${path}`)}"/>`),
          `<xhtml:link rel="alternate" hreflang="x-default" href="${escape(`${SITE_URL}/pt${path}`)}"/>`,
          lastmod ? `<lastmod>${lastmod}</lastmod>` : "",
          `<priority>${priority}</priority>`,
          "</url>",
        ].join("")));
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
