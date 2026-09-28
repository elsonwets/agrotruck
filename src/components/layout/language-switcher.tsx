import { useLocation } from "@tanstack/react-router";
import { Check, Globe } from "lucide-react";
import { LANGS } from "~/shared/domain";
import { dictFor } from "~/i18n";
import { useLang, useT } from "~/lib/i18n";

// Même page dans une autre langue : on remplace seulement le premier segment de l'URL.
export function LanguageSwitcher({ align = "right" }: { align?: "left" | "right" }) {
  const lang = useLang();
  const t = useT();
  const { pathname, searchStr } = useLocation();
  const hrefFor = (other: string) => `/${other}${pathname.replace(/^\/(fr|en|pt)(?=\/|$)/, "")}${searchStr}`;

  return <details className="group relative">
    <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-brand-200 [&::-webkit-details-marker]:hidden" aria-label={t.nav.language}>
      <Globe className="size-4 text-brand-700" aria-hidden="true" />
      {lang.toUpperCase()}
    </summary>
    <div className={`absolute ${align === "left" ? "left-0" : "right-0"} z-50 mt-2 w-44 rounded-xl border border-line bg-white p-1.5 shadow-[var(--shadow-card)]`}>
      {LANGS.map((other) => (
        <a key={other} href={hrefFor(other)} hrefLang={other} lang={other} aria-current={other === lang ? "true" : undefined}
          className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-brand-50">
          <span><strong className="mr-2 text-xs text-brand-700">{other.toUpperCase()}</strong>{dictFor(other).langName}</span>
          {other === lang && <Check className="size-4 text-brand-700" aria-hidden="true" />}
        </a>
      ))}
    </div>
  </details>;
}
