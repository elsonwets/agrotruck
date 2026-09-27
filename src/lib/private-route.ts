import { dictFor } from "~/i18n";
import type { Lang } from "~/shared/domain";

// Pages privées : titre simple, jamais indexées.
export function privateHead(lang: string, title?: string) {
  const t = dictFor(lang as Lang);
  return { meta: [{ title: `${title ?? t.meta.private} | ${t.meta.siteName}` }, { name: "robots", content: "noindex, nofollow" }] };
}
