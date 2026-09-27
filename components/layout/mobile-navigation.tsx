"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, LogOut, Menu, MessageCircle, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { useAppSettings } from "@/components/providers/app-providers";
import { HeaderControls } from "./header-controls";
import { truckRegistrationWhatsappUrl } from "@/lib/contact";
import { homeForRole, useSession } from "@/lib/use-session";
import { initials, roleLabels } from "./account-menu";

const links = [
  ["nav.rental", "/location"], ["nav.sale", "/vente"], ["nav.how", "/comment-ca-marche"], ["nav.about", "/about"],
] as const;
export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { t } = useAppSettings();
  const { session, status, logout } = useSession();
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);
  return <div className="lg:hidden">
    <div className="flex items-center gap-2"><div className="hidden sm:block"><HeaderControls/></div>{session && <Link href={homeForRole[session.role]} aria-label={`${t("account.space")} — ${session.displayName}`} className="focus-ring grid size-11 place-items-center rounded-xl bg-primary text-sm font-bold text-white">{initials(session.displayName)}</Link>}<button className="focus-ring grid size-11 place-items-center rounded-xl border border-primary/15 bg-primary/5 text-primary" onClick={() => setOpen(true)} aria-label={t("menu.open")} aria-expanded={open} aria-controls="mobile-navigation-dialog"><Menu/></button></div>
    {typeof document !== "undefined" && createPortal(<AnimatePresence>{open && <motion.div id="mobile-navigation-dialog" className="mobile-menu fixed inset-0 z-[100] min-h-dvh overflow-y-auto overscroll-contain bg-[#fffdf8]/97 backdrop-blur-xl lg:hidden" role="dialog" aria-modal="true" aria-label={t("menu.open")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2, ease: "easeOut" }}>
      <div className="brand-road"/><div className="page-shell flex h-20 items-center justify-between gap-3"><BrandLogo compact className="w-16 shrink-0 sm:w-[205px]"/><div className="flex shrink-0 items-center gap-2"><HeaderControls compact/><button ref={closeButtonRef} className="focus-ring grid size-10 place-items-center rounded-xl border border-primary/15 text-primary" onClick={() => setOpen(false)} aria-label={t("menu.close")}><X/></button></div></div>
      <motion.nav className="page-shell flex flex-col gap-2 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8" aria-label="Navegação móvel" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: .045 } } }}>{links.map(([key, href]) => <motion.div key={href} variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: .2 }}><Link href={href} onClick={() => setOpen(false)} className="focus-ring block border-b border-primary/10 py-4 font-heading text-2xl font-semibold text-foreground">{t(key)}</Link></motion.div>)}<motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: .2 }} className="mt-6 grid gap-2">
        {session && <>
          <div className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-white p-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-white">{initials(session.displayName)}</span>
            <div className="min-w-0"><p className="truncate font-semibold text-foreground">{session.displayName}</p><p className="text-xs text-muted-foreground">{roleLabels[session.role]}</p></div>
          </div>
          <Button asChild size="lg" className="w-full"><Link href={homeForRole[session.role]} onClick={close}><LayoutDashboard className="size-4" />{t("account.space")}</Link></Button>
          <Button asChild size="lg" variant="secondary" className="w-full"><Link href="/profil" onClick={close}><UserRound className="size-4" />{t("account.profile")}</Link></Button>
          <Button size="lg" variant="ghost" className="w-full text-danger hover:bg-danger/5 hover:text-danger" onClick={() => { close(); void logout(); }}><LogOut className="size-4" />{t("account.logout")}</Button>
        </>}
        {status === "unauthenticated" && <>
          <Button asChild size="lg" className="w-full"><Link href="/login" onClick={close}>{t("account.login")}</Link></Button>
          <Button asChild size="lg" variant="secondary" className="w-full"><Link href="/inscription" onClick={close}>{t("account.signup")}</Link></Button>
          <Button asChild size="lg" variant="ghost" className="w-full"><a href={truckRegistrationWhatsappUrl} target="_blank" rel="noreferrer" onClick={close}><MessageCircle className="size-4" />{t("account.becomePartner")}</a></Button>
        </>}
      </motion.div></motion.nav>
    </motion.div>}</AnimatePresence>, document.body)}
  </div>;
}
