"use client";

import { Check, Globe2, Moon, Sun } from "lucide-react";
import { useRef } from "react";
import { type Language, useAppSettings } from "@/components/providers/app-providers";
import { cn } from "@/lib/utils";

const languages: { code: Language; short: string; label: string }[] = [
  { code: "pt", short: "PT", label: "Português" },
  { code: "fr", short: "FR", label: "Français" },
  { code: "en", short: "EN", label: "English" },
];

export function HeaderControls({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { language, setLanguage, theme, toggleTheme, t } = useAppSettings();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  return <div className={cn("flex items-center gap-2", className)}>
    <details ref={detailsRef} className="group relative">
      <summary className={cn("theme-control focus-ring flex h-10 cursor-pointer list-none items-center rounded-xl border border-primary/15 bg-white text-xs font-bold text-primary shadow-sm transition hover:border-primary/30", compact ? "w-10 justify-center" : "gap-1.5 px-3")} aria-label={`${t("controls.language")} — ${language.toUpperCase()}`}>
        <Globe2 className="size-4"/>{!compact && <span>{language.toUpperCase()}</span>}
      </summary>
      <div className="theme-menu absolute right-0 top-12 z-50 w-44 overflow-hidden rounded-xl border border-primary/15 bg-white p-1.5 shadow-xl">
        {languages.map((item) => <button key={item.code} type="button" onClick={() => { setLanguage(item.code); detailsRef.current?.removeAttribute("open"); }} className="focus-ring flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#4e4a43] hover:bg-primary/7 hover:text-primary">
          <span><strong className="mr-2 text-xs text-primary">{item.short}</strong>{item.label}</span>{language === item.code && <Check className="size-4 text-primary"/>}
        </button>)}
      </div>
    </details>
    <button type="button" onClick={toggleTheme} className="theme-control focus-ring grid size-10 place-items-center rounded-xl border border-primary/15 bg-white text-primary shadow-sm transition hover:border-primary/30" aria-label={theme === "light" ? t("controls.themeDark") : t("controls.themeLight")} title={theme === "light" ? t("controls.themeDark") : t("controls.themeLight")}>
      {theme === "light" ? <Moon className="size-4"/> : <Sun className="size-4"/>}
    </button>
  </div>;
}
