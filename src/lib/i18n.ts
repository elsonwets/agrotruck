import { useParams } from "@tanstack/react-router";
import { DEFAULT_LANG, isLang, type Lang } from "~/shared/domain";
import { dictFor, type Dict } from "~/i18n";

// Langue courante = premier segment de l'URL (/fr, /en, /pt).
export function useLang(): Lang {
  const { lang } = useParams({ strict: false }) as { lang?: string };
  return isLang(lang) ? lang : DEFAULT_LANG;
}

export function useT(): Dict {
  return dictFor(useLang());
}
