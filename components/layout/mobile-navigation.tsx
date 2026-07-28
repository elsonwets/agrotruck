"use client";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { useAppSettings } from "@/components/providers/app-providers";
import { HeaderControls } from "./header-controls";

const links = [
  ["nav.how", "/comment-ca-marche"], ["nav.about", "/about"],
] as const;
export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const { t } = useAppSettings();
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  return <div className="lg:hidden">
    <div className="flex items-center gap-2"><div className="hidden sm:block"><HeaderControls/></div><button className="focus-ring grid size-11 place-items-center rounded-xl border border-primary/15 bg-primary/5 text-primary" onClick={() => setOpen(true)} aria-label={t("menu.open")}><Menu/></button></div>
    {open && <div className="mobile-menu fixed inset-0 z-50 bg-[#fffdf8]/97 backdrop-blur-xl">
      <div className="brand-road"/><div className="page-shell flex h-20 items-center justify-between gap-3"><BrandLogo compact className="w-[205px]"/><div className="flex items-center gap-2"><HeaderControls/><button className="focus-ring grid size-10 place-items-center rounded-xl border border-primary/15 text-primary" onClick={() => setOpen(false)} aria-label={t("menu.close")}><X/></button></div></div>
      <nav className="page-shell flex flex-col gap-2 pt-8">{links.map(([key, href]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="focus-ring border-b border-primary/10 py-4 font-heading text-2xl font-semibold text-foreground">{t(key)}</Link>)}<Button asChild size="lg" className="mt-6"><Link href="/devenir-partenaire" onClick={() => setOpen(false)}>{t("auth.register")}</Link></Button></nav>
    </div>}
  </div>;
}
