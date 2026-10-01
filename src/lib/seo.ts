import { DEFAULT_LANG, LANGS, type Lang } from "~/shared/domain";
import { dictFor } from "~/i18n";

// URL publique du site (Vercel : VITE_SITE_URL à définir sur le domaine final).
export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ?? "https://agro-truck.com";

const OG_IMAGE = `${SITE_URL}/brand/agrotruck-lockup.png`;

interface SeoInput {
  lang: Lang;
  path: string; // chemin sans la langue, ex. "/pricing" ou "" pour l'accueil
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
  type?: "website" | "article" | "product";
  jsonLd?: object[];
}

// Métadonnées complètes d'une page : titre, description, canonique, hreflang (3 langues + x-default),
// Open Graph, Twitter et données structurées JSON-LD.
export function seo({ lang, path, title, description, image = OG_IMAGE, noindex, type = "website", jsonLd = [] }: SeoInput) {
  const dict = dictFor(lang);
  const url = `${SITE_URL}/${lang}${path}`;
  const fullTitle = title.includes(dict.meta.siteName) ? title : `${title} | ${dict.meta.siteName}`;
  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      ...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : [{ name: "robots", content: "index, follow, max-image-preview:large" }]),
      { property: "og:type", content: type },
      { property: "og:site_name", content: dict.meta.siteName },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:locale", content: dict.ogLocale },
      ...LANGS.filter((other) => other !== lang).map((other) => ({ property: "og:locale:alternate", content: dictFor(other).ogLocale })),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: image },
    ],
    links: noindex ? [] : [
      { rel: "canonical", href: url },
      ...LANGS.map((other) => ({ rel: "alternate", hrefLang: other, href: `${SITE_URL}/${other}${path}` })),
      { rel: "alternate", hrefLang: "x-default", href: `${SITE_URL}/${DEFAULT_LANG}${path}` },
    ],
    scripts: jsonLd.map((data) => ({ type: "application/ld+json", children: JSON.stringify(data) })),
  };
}

export function organizationJsonLd(lang: Lang) {
  const dict = dictFor(lang);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: dict.meta.siteName,
    url: SITE_URL,
    logo: `${SITE_URL}/brand/agrotruck-icon-512.png`,
    description: dict.footer.about,
    areaServed: { "@type": "Country", name: "Guinea-Bissau" },
  };
}

export function websiteJsonLd(lang: Lang) {
  const dict = dictFor(lang);
  return { "@context": "https://schema.org", "@type": "WebSite", name: dict.meta.siteName, url: `${SITE_URL}/${lang}`, inLanguage: dict.locale };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
  };
}
