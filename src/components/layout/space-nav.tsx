import { Link } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useLang, useT } from "~/lib/i18n";
import { useSession } from "~/lib/session";
import type { Role } from "~/shared/domain";

type Tab = { to: string; search?: Record<string, string>; label: string; exact?: boolean };

// Onglets de l'espace connecté, adaptés au rôle ; « Se déconnecter » toujours visible.
export function SpaceNav() {
  const lang = useLang();
  const t = useT();
  const { session, signOut } = useSession();
  if (!session) return null;

  const tabs: Record<Role, Tab[]> = {
    producer: [
      { to: "/$lang/producer", label: t.space.producerTabs.missions, exact: true },
      { to: "/$lang/producer/new", label: t.space.producerTabs.new },
      { to: "/$lang/profile", label: t.nav.profile },
    ],
    transporter: [
      { to: "/$lang/transporter", label: t.space.transporterTabs.available, exact: true },
      { to: "/$lang/transporter/missions", label: t.space.transporterTabs.assigned },
      { to: "/$lang/transporter/trucks", label: t.space.transporterTabs.trucks },
      { to: "/$lang/profile", label: t.nav.profile },
    ],
    admin: [
      { to: "/$lang/admin", label: t.space.adminTabs.dashboard, exact: true },
      { to: "/$lang/admin/missions", label: t.space.adminTabs.missions },
      { to: "/$lang/admin/users", label: t.space.adminTabs.users },
      { to: "/$lang/admin/trucks", label: t.space.adminTabs.trucks },
      { to: "/$lang/profile", label: t.nav.profile },
    ],
  };

  return <div data-print-hidden className="border-b border-line bg-white">
    <nav aria-label={t.nav.mySpace} className="container-page flex items-center gap-2">
      <div className="scroll-row -mb-px flex flex-1 gap-1 overflow-x-auto">
        {tabs[session.role].map((tab) => (
          <Link key={tab.to} to={tab.to} params={{ lang }} activeOptions={{ exact: tab.exact ?? false, includeSearch: false }}
            className="shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-3.5 text-sm font-semibold text-muted hover:text-ink"
            activeProps={{ className: "border-harvest-400 text-brand-800", "aria-current": "page" }}>
            {tab.label}
          </Link>
        ))}
      </div>
      <button type="button" onClick={() => void signOut(lang)} className="hidden shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#a3201b] hover:bg-flag-50 sm:flex">
        <LogOut className="size-4" aria-hidden="true" />{t.nav.logout}
      </button>
    </nav>
  </div>;
}
