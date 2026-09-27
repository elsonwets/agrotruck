"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogOut } from "lucide-react";
import { useSession, type Role } from "@/lib/use-session";
import { cn } from "@/lib/utils";

type SpaceLink = { href: string; label: string };

const spaceLinks: Record<Role, SpaceLink[]> = {
  producer: [
    { href: "/producteur", label: "Mes transports" },
    { href: "/producteur/demande/nouvelle", label: "Nouvelle demande" },
    { href: "/profil", label: "Mon profil" },
  ],
  partner: [
    { href: "/partner?tab=disponibles", label: "Missions disponibles" },
    { href: "/partner?tab=missions", label: "Mes missions" },
    { href: "/partner?tab=camions", label: "Mes camions" },
    { href: "/profil", label: "Mon profil" },
  ],
  admin: [
    { href: "/admin", label: "Flotte" },
    { href: "/admin/queue", label: "Validation" },
    { href: "/admin/partners", label: "Partenaires" },
    { href: "/admin/orders", label: "Demandes" },
    { href: "/profil", label: "Mon profil" },
  ],
};

// Onglets de l'espace connecté, adaptés au rôle, avec la déconnexion toujours visible.
export function SpaceNav() {
  const { session, logout } = useSession();
  const pathname = usePathname();
  const params = useSearchParams();
  if (!session) return null;

  const isActive = ({ href }: SpaceLink) => {
    const [path, query] = href.split("?");
    if (path !== pathname) return false;
    if (!query) return true;
    const tab = new URLSearchParams(query).get("tab");
    return (params.get("tab") ?? "disponibles") === tab;
  };

  return <div className="border-b border-primary/10 bg-white">
    <nav className="page-shell flex items-center gap-2" aria-label="Mon espace">
      <div className="scrollbar-thin -mb-px flex flex-1 gap-1 overflow-x-auto">
        {spaceLinks[session.role].map((link) => (
          <Link key={link.href} href={link.href} aria-current={isActive(link) ? "page" : undefined}
            className={cn("focus-ring shrink-0 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm font-semibold transition", isActive(link) ? "border-warning text-primary" : "border-transparent text-foreground/60 hover:text-primary")}>
            {link.label}
          </Link>
        ))}
      </div>
      <button type="button" onClick={() => void logout()} className="focus-ring hidden shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-danger hover:bg-danger/5 sm:flex"><LogOut className="size-4" />Se déconnecter</button>
    </nav>
  </div>;
}
