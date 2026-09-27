"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { useAppSettings } from "@/components/providers/app-providers";
import { homeForRole, useSession, type Role } from "@/lib/use-session";

export const roleLabels: Record<Role, string> = { admin: "Badora", partner: "Transporteur", producer: "Producteur" };

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
}

// Menu du compte connecté : espace, profil, déconnexion.
export function AccountMenu() {
  const { session, logout } = useSession();
  const { t } = useAppSettings();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  if (!session) return null;
  const close = () => detailsRef.current?.removeAttribute("open");
  const item = "focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#4e4a43] hover:bg-primary/7 hover:text-primary";

  return <details ref={detailsRef} className="group relative">
    <summary className="focus-ring flex h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-primary/15 bg-white pl-1.5 pr-2.5 text-primary shadow-sm transition hover:border-primary/30" aria-label={`${t("account.menu")} — ${session.displayName}`}>
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-[11px] font-bold text-white">{initials(session.displayName)}</span>
      <span className="max-w-[120px] truncate text-[13px] font-semibold">{session.displayName}</span>
      <ChevronDown className="size-4 transition group-open:rotate-180" />
    </summary>
    <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-primary/15 bg-white p-1.5 shadow-xl">
      <p className="px-3 pb-2 pt-1.5 text-xs text-muted-foreground">{roleLabels[session.role]}</p>
      <Link href={homeForRole[session.role]} onClick={close} className={item}><LayoutDashboard className="size-4" />{t("account.space")}</Link>
      <Link href="/profil" onClick={close} className={item}><UserRound className="size-4" />{t("account.profile")}</Link>
      <div className="my-1 h-px bg-primary/10" />
      <button type="button" onClick={() => { close(); void logout(); }} className={`${item} text-danger hover:bg-danger/5 hover:text-danger`}><LogOut className="size-4" />{t("account.logout")}</button>
    </div>
  </details>;
}
