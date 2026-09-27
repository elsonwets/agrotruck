import { Link } from "@tanstack/react-router";
import { MapPin, MessageCircle } from "lucide-react";
import { useLang, useT } from "~/lib/i18n";
import { Brand } from "./brand";
import { InstallAppButton } from "./install-app-button";

export function Footer() {
  const lang = useLang();
  const t = useT();
  const link = "text-white/75 hover:text-white";
  return <footer className="mt-auto bg-brand-900 text-white">
    <div className="brand-stripe" />
    <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
      <div className="lg:col-span-2">
        <Brand inverted />
        <p className="mt-4 max-w-sm text-sm text-white/75">{t.footer.about}</p>
        <div className="mt-6 max-w-xs"><InstallAppButton /></div>
      </div>
      <nav aria-label={t.footer.explore}>
        <p className="text-sm font-semibold">{t.footer.explore}</p>
        <ul className="mt-4 space-y-2.5 text-sm">
          <li><Link to="/$lang" params={{ lang }} className={link}>{t.nav.transport}</Link></li>
          <li><Link to="/$lang/rental" params={{ lang }} className={link}>{t.nav.rental}</Link></li>
          <li><Link to="/$lang/sale" params={{ lang }} className={link}>{t.nav.sale}</Link></li>
          <li><Link to="/$lang/how-it-works" params={{ lang }} className={link}>{t.nav.howItWorks}</Link></li>
          <li><Link to="/$lang/pricing" params={{ lang }} className={link}>{t.nav.pricing}</Link></li>
          <li><Link to="/$lang/about" params={{ lang }} className={link}>{t.nav.about}</Link></li>
        </ul>
      </nav>
      <div>
        <p className="text-sm font-semibold">{t.footer.contact}</p>
        <ul className="mt-4 space-y-2.5 text-sm text-white/75">
          <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-harvest-400" aria-hidden="true" />Bissau, Guiné-Bissau</li>
          <li className="flex gap-2"><MessageCircle className="mt-0.5 size-4 shrink-0 text-harvest-400" aria-hidden="true" /><a href="mailto:contact@agro-truck.com" className={link}>contact@agro-truck.com</a></li>
        </ul>
      </div>
    </div>
    <div className="border-t border-white/10 py-5 text-center text-xs text-white/60">{t.footer.rights(new Date().getFullYear())}</div>
  </footer>;
}
