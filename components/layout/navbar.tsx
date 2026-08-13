"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { useAppSettings } from "@/components/providers/app-providers";
import { MobileNavigation } from "./mobile-navigation";
import { HeaderControls } from "./header-controls";
import { truckRegistrationWhatsappUrl } from "@/lib/contact";

const links = [["nav.companies", "/entreprises"], ["nav.how", "/comment-ca-marche"], ["nav.about", "/about"]] as const;

export function Navbar() {
  const { t } = useAppSettings();
  return <header className="site-header sticky top-0 z-40 border-b border-primary/10 bg-white/94 backdrop-blur-xl"><div className="brand-road"/><div className="page-shell flex h-[72px] items-center justify-between gap-4">
    <BrandLogo compact className="w-[190px] shrink-0 sm:w-[210px]" />
    <nav className="hidden items-center gap-6 lg:flex" aria-label="Navegação principal">{links.map(([key, href]) => <Link key={href} href={href} className="focus-ring whitespace-nowrap text-[13px] font-medium text-foreground/65 transition hover:text-primary">{t(key)}</Link>)}</nav>
    <div className="hidden shrink-0 items-center gap-2 lg:flex"><HeaderControls/><Button asChild className="whitespace-nowrap"><a href={truckRegistrationWhatsappUrl} target="_blank" rel="noreferrer"><MessageCircle className="size-4" />Cadastrar camiões</a></Button></div>
    <MobileNavigation />
  </div></header>;
}
