import { Link } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, PlusCircle, Route, Search, Truck, UserRound, Users, type LucideIcon } from "lucide-react";
import { useLang, useT } from "~/lib/i18n";
import { useSession } from "~/lib/session";
import type { Role } from "~/shared/domain";

type Tab = { to: string; label: string; icon: LucideIcon; exact?: boolean };

// Onglets de l'espace connecté, adaptés au rôle. La déconnexion est dans le menu de l'avatar (en-tête).
export function SpaceNav() {
  const lang = useLang();
  const t = useT();
  const { session } = useSession();
  if (!session) return null;

  const profile: Tab = { to: "/$lang/profile", label: t.nav.profile, icon: UserRound };
  const tabs: Record<Role, Tab[]> = {
    producer: [
      { to: "/$lang/producer", label: t.space.producerTabs.missions, icon: ClipboardList, exact: true },
      { to: "/$lang/producer/new", label: t.space.producerTabs.new, icon: PlusCircle },
      profile,
    ],
    transporter: [
      { to: "/$lang/transporter", label: t.space.transporterTabs.available, icon: Search, exact: true },
      { to: "/$lang/transporter/missions", label: t.space.transporterTabs.assigned, icon: Route },
      { to: "/$lang/transporter/trucks", label: t.space.transporterTabs.trucks, icon: Truck },
      profile,
    ],
    admin: [
      { to: "/$lang/admin", label: t.space.adminTabs.dashboard, icon: LayoutDashboard, exact: true },
      { to: "/$lang/admin/missions", label: t.space.adminTabs.missions, icon: ClipboardList },
      { to: "/$lang/admin/users", label: t.space.adminTabs.users, icon: Users },
      { to: "/$lang/admin/trucks", label: t.space.adminTabs.trucks, icon: Truck },
      profile,
    ],
  };

  return <div data-print-hidden className="border-b border-line bg-white">
    <nav aria-label={t.nav.mySpace} className="container-page">
      <div className="scroll-row -mb-px flex gap-1 overflow-x-auto">
        {tabs[session.role].map(({ to, label, icon: Icon, exact }) => (
          <Link key={to} to={to} params={{ lang }} activeOptions={{ exact: exact ?? false, includeSearch: false }}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-3.5 text-sm font-semibold text-muted hover:text-ink"
            activeProps={{ className: "border-harvest-400 text-brand-800", "aria-current": "page" }}>
            <Icon className="size-4" aria-hidden="true" />{label}
          </Link>
        ))}
      </div>
    </nav>
  </div>;
}
