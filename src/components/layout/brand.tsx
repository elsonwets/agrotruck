import { Link } from "@tanstack/react-router";
import { useLang } from "~/lib/i18n";

export function Brand({ inverted = false }: { inverted?: boolean }) {
  const lang = useLang();
  return <Link to="/$lang" params={{ lang }} className="inline-flex items-center gap-2.5" aria-label="AgroTrucks">
    <img src="/brand/agrotruck-mark-transparent.webp" alt="" width={54} height={29} className="h-8 w-auto" />
    <span className={`text-xl font-bold tracking-tight ${inverted ? "text-white" : "text-brand-800"}`}>
      Agro<span className={inverted ? "text-harvest-400" : "text-flag-500"}>Trucks</span>
    </span>
  </Link>;
}
