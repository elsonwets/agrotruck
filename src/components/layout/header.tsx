import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, Menu, UserRound, X } from "lucide-react";
import { buttonClass } from "~/components/ui/button";
import { useLang, useT } from "~/lib/i18n";
import { homePath, useSession } from "~/lib/session";
import { AccountMenu, Avatar } from "./account-menu";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";

const navLinks = [
  ["/$lang", "transport"],
  ["/$lang/rental", "rental"],
  ["/$lang/sale", "sale"],
  ["/$lang/fleet", "fleet"],
  ["/$lang/how-it-works", "howItWorks"],
  ["/$lang/pricing", "pricing"],
  ["/$lang/about", "about"],
] as const;

export function Header() {
  const lang = useLang();
  const t = useT();
  const { status, session, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const navClass = "rounded-lg px-3 py-2 text-[15px] font-medium text-muted hover:bg-brand-50 hover:text-ink";

  return <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-sm">
    <div className="brand-stripe" />
    <div className="container-page flex h-16 items-center justify-between gap-4">
      <Brand />

      <nav aria-label={t.nav.mainNav} className="hidden items-center gap-1 lg:flex">
        {navLinks.map(([to, key]) => (
          <Link key={to} to={to} params={{ lang }} activeOptions={{ exact: true }} className={navClass} activeProps={{ className: "bg-brand-50 text-ink", "aria-current": "page" }}>
            {t.nav[key]}
          </Link>
        ))}
      </nav>

      <div className="hidden items-center gap-2 lg:flex">
        <LanguageSwitcher />
        {status === "loading" && <div className="h-10 w-52" aria-hidden="true" />}
        {session && <>
          <Link to={homePath[session.role]} params={{ lang }} className={buttonClass("primary", "sm")}><LayoutDashboard aria-hidden="true" />{t.nav.mySpace}</Link>
          <AccountMenu />
        </>}
        {status === "unauthenticated" && <>
          <Link to="/$lang/login" params={{ lang }} className={buttonClass("ghost", "sm")}>{t.nav.login}</Link>
          <Link to="/$lang/signup" params={{ lang }} className={buttonClass("primary", "sm")}>{t.nav.signup}</Link>
        </>}
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        {session && <Link to={homePath[session.role]} params={{ lang }} aria-label={t.nav.mySpace}><Avatar name={session.displayName} size="lg" /></Link>}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? t.nav.closeMenu : t.nav.openMenu}
          className="grid size-11 place-items-center rounded-xl border border-line bg-white text-ink">
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
        </button>
      </div>
    </div>

    {open && <div id="mobile-menu" className="border-t border-line bg-white lg:hidden">
      <nav aria-label={t.nav.mainNav} className="container-page grid gap-1 py-4">
        {navLinks.map(([to, key]) => (
          <Link key={to} to={to} params={{ lang }} onClick={close} activeOptions={{ exact: true }} className="rounded-xl px-3 py-3 text-base font-medium text-ink hover:bg-brand-50" activeProps={{ className: "bg-brand-50", "aria-current": "page" }}>
            {t.nav[key]}
          </Link>
        ))}
        <div className="mt-3 border-t border-line pt-4"><LanguageSwitcher align="left" /></div>
        <div className="mt-3 grid gap-2">
          {session && <>
            <div className="flex items-center gap-3 rounded-xl bg-canvas p-3">
              <Avatar name={session.displayName} size="lg" />
              <div className="min-w-0"><p className="truncate font-semibold">{session.displayName}</p><p className="text-xs text-muted">{t.roles[session.role]}</p></div>
            </div>
            <Link to={homePath[session.role]} params={{ lang }} onClick={close} className={buttonClass("primary", "lg")}><LayoutDashboard aria-hidden="true" />{t.nav.mySpace}</Link>
            <Link to="/$lang/profile" params={{ lang }} onClick={close} className={buttonClass("secondary", "lg")}><UserRound aria-hidden="true" />{t.nav.profile}</Link>
            <button type="button" onClick={() => { close(); void signOut(lang); }} className={buttonClass("ghost", "lg", "text-[#a3201b] hover:bg-flag-50")}><LogOut aria-hidden="true" />{t.nav.logout}</button>
          </>}
          {status === "unauthenticated" && <>
            <Link to="/$lang/signup" params={{ lang }} onClick={close} className={buttonClass("primary", "lg")}>{t.nav.signup}</Link>
            <Link to="/$lang/login" params={{ lang }} onClick={close} className={buttonClass("secondary", "lg")}>{t.nav.login}</Link>
          </>}
        </div>
      </nav>
    </div>}
  </header>;
}
