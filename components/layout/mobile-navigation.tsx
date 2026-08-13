"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { useAppSettings } from "@/components/providers/app-providers";
import { HeaderControls } from "./header-controls";
import { truckRegistrationWhatsappUrl } from "@/lib/contact";

const links = [
  ["nav.rental", "/location"], ["nav.sale", "/vente"], ["nav.companies", "/entreprises"], ["nav.how", "/comment-ca-marche"], ["nav.about", "/about"],
] as const;
export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { t } = useAppSettings();
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
    <div className="flex items-center gap-2"><div className="hidden sm:block"><HeaderControls/></div><button className="focus-ring grid size-11 place-items-center rounded-xl border border-primary/15 bg-primary/5 text-primary" onClick={() => setOpen(true)} aria-label={t("menu.open")} aria-expanded={open} aria-controls="mobile-navigation-dialog"><Menu/></button></div>
    {typeof document !== "undefined" && createPortal(<AnimatePresence>{open && <motion.div id="mobile-navigation-dialog" className="mobile-menu fixed inset-0 z-[100] min-h-dvh overflow-y-auto overscroll-contain bg-[#fffdf8]/97 backdrop-blur-xl lg:hidden" role="dialog" aria-modal="true" aria-label={t("menu.open")} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .2, ease: "easeOut" }}>
      <div className="brand-road"/><div className="page-shell flex h-20 items-center justify-between gap-3"><BrandLogo compact className="w-16 shrink-0 sm:w-[205px]"/><div className="flex shrink-0 items-center gap-2"><HeaderControls compact/><button ref={closeButtonRef} className="focus-ring grid size-10 place-items-center rounded-xl border border-primary/15 text-primary" onClick={() => setOpen(false)} aria-label={t("menu.close")}><X/></button></div></div>
      <motion.nav className="page-shell flex flex-col gap-2 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8" aria-label="Navegação móvel" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: .045 } } }}>{links.map(([key, href]) => <motion.div key={href} variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: .2 }}><Link href={href} onClick={() => setOpen(false)} className="focus-ring block border-b border-primary/10 py-4 font-heading text-2xl font-semibold text-foreground">{t(key)}</Link></motion.div>)}<motion.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: .2 }}><Button asChild size="lg" className="mt-6 w-full"><a href={truckRegistrationWhatsappUrl} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><MessageCircle className="size-4" />Cadastrar camiões</a></Button></motion.div></motion.nav>
    </motion.div>}</AnimatePresence>, document.body)}
  </div>;
}
