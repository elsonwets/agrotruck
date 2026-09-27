"use client";

import Link from "next/link";
import { LayoutDashboard, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { useAppSettings } from "@/components/providers/app-providers";
import { MobileNavigation } from "./mobile-navigation";
import { HeaderControls } from "./header-controls";
import { truckRegistrationWhatsappUrl } from "@/lib/contact";
import { homeForRole, useSession } from "@/lib/use-session";
import { AccountMenu } from "./account-menu";

const links = [["nav.rental", "/location"], ["nav.sale", "/vente"], ["nav.how", "/comment-ca-marche"], ["nav.about", "/about"]] as const;

export function Navbar() {
  const { t } = useAppSettings();
  const { status, session } = useSession();
  return <header className="site-header sticky top-0 z-40 border-b border-primary/10 bg-white/94 backdrop-blur-xl"><div className="brand-road"/><div className="page-shell flex h-[72px] items-center justify-between gap-4">
    <BrandLogo compact className="w-[190px] shrink-0 sm:w-[210px]" />
    <nav className="hidden items-center gap-6 lg:flex" aria-label="Navegação principal">{links.map(([key, href]) => <Link key={href} href={href} className="focus-ring whitespace-nowrap text-[13px] font-medium text-foreground/65 transition hover:text-primary">{t(key)}</Link>)}</nav>
    <div className="hidden shrink-0 items-center gap-2 lg:flex">
      <HeaderControls/>
      {status === "loading" && <div className="h-10 w-[220px]" aria-hidden="true" />}
      {session && <>
        <Button asChild className="whitespace-nowrap"><Link href={homeForRole[session.role]}><LayoutDashboard className="size-4" />{t("account.space")}</Link></Button>
        <AccountMenu />
      </>}
      {status === "unauthenticated" && <>
        <Link href="/login" className="focus-ring whitespace-nowrap px-2 text-[13px] font-semibold text-foreground/65 hover:text-primary">{t("account.login")}</Link>
        <Button asChild className="whitespace-nowrap"><a href={truckRegistrationWhatsappUrl} target="_blank" rel="noreferrer"><MessageCircle className="size-4" />{t("account.becomePartner")}</a></Button>
      </>}
    </div>
    <MobileNavigation />
  </div></header>;
}
