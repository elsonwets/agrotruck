import { DEFAULT_LANG, LANGS, type Lang } from "~/shared/domain";
import { en } from "./en";
import { fr, type Dict } from "./fr";
import { pt } from "./pt";

export type { Dict };

export const dictionaries: Record<Lang, Dict> = { fr, en, pt };

export const dictFor = (lang: Lang): Dict => dictionaries[lang];

// Langue préférée d'après l'en-tête Accept-Language (ex. « fr-FR,fr;q=0.9,en;q=0.8 »).
export function negotiateLang(acceptLanguage: string | null | undefined): Lang {
  const wanted = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, quality] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: quality ? Number(quality) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return (wanted.find((entry) => LANGS.includes(entry.lang as Lang))?.lang as Lang | undefined) ?? DEFAULT_LANG;
}
