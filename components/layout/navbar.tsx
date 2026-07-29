"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { useAppSettings } from "@/components/providers/app-providers";
import { MobileNavigation } from "./mobile-navigation";
import { HeaderControls } from "./header-controls";
import { authClient } from "@/lib/auth-client";

const links = [["nav.companies", "/entreprises"], ["nav.pricing", "/pricing"], ["nav.how", "/comment-ca-marche"], ["nav.about", "/about"]] as const;
export function Navbar() { const { t } = useAppSettings(); const { data: session } = authClient.useSession(); const authenticated = Boolean(session); return <header className="site-header sticky top-0 z-40 border-b border-primary/10 bg-white/94 backdrop-blur-xl"><div className="brand-road"/><div className="page-shell flex h-[72px] items-center justify-between gap-4">
  <BrandLogo compact className="w-[190px] shrink-0 sm:w-[210px]" />
  <nav className="hidden items-center gap-6 lg:flex" aria-label="Navegação principal">{links.map(([key, href]) => <Link key={href} href={href} className="focus-ring whitespace-nowrap text-[13px] font-medium text-foreground/65 transition hover:text-primary">{t(key)}</Link>)}</nav>
  <div className="hidden shrink-0 items-center gap-2 lg:flex"><HeaderControls/>{authenticated&&<Link href="/account" className="focus-ring grid size-10 place-items-center rounded-full border border-primary/10 text-primary transition hover:bg-primary/5" aria-label="A minha conta"><UserRound className="size-4"/></Link>}<Button asChild className="whitespace-nowrap"><Link href={authenticated ? "/dashboard" : "/devenir-partenaire"}>{t(authenticated ? "auth.dashboard" : "auth.register")}</Link></Button></div>
  <MobileNavigation authenticated={authenticated} />
</div></header>; }
