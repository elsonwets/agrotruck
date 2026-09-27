import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { useLang, useT } from "~/lib/i18n";
import { homePath, useSession } from "~/lib/session";

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-brand-800 font-semibold text-white ${size === "lg" ? "size-11 text-sm" : "size-8 text-xs"}`}>{initials(name)}</span>;
}

// Menu du compte connecté : espace, profil, déconnexion.
export function AccountMenu() {
  const { session, signOut } = useSession();
  const lang = useLang();
  const t = useT();
  const details = useRef<HTMLDetailsElement>(null);
  if (!session) return null;
  const close = () => details.current?.removeAttribute("open");
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-brand-50";

  return <details ref={details} className="group relative">
    <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl border border-line bg-white py-1 pl-1 pr-2.5 hover:border-brand-200 [&::-webkit-details-marker]:hidden" aria-label={`${t.nav.account} — ${session.displayName}`}>
      <Avatar name={session.displayName} />
      <span className="max-w-32 truncate text-sm font-semibold">{session.displayName}</span>
      <ChevronDown className="size-4 text-muted" aria-hidden="true" />
    </summary>
    <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-line bg-white p-1.5 shadow-[var(--shadow-card)]">
      <p className="px-3 pb-2 pt-1.5 text-xs text-muted">{t.roles[session.role]}</p>
      <Link to={homePath[session.role]} params={{ lang }} onClick={close} className={item}><LayoutDashboard className="size-4 text-brand-700" aria-hidden="true" />{t.nav.mySpace}</Link>
      <Link to="/$lang/profile" params={{ lang }} onClick={close} className={item}><UserRound className="size-4 text-brand-700" aria-hidden="true" />{t.nav.profile}</Link>
      <div className="my-1 h-px bg-line" />
      <button type="button" onClick={() => { close(); void signOut(lang); }} className={`${item} text-[#a3201b] hover:bg-flag-50`}><LogOut className="size-4" aria-hidden="true" />{t.nav.logout}</button>
    </div>
  </details>;
}
