import { Link } from "@tanstack/react-router";
import { buttonClass } from "~/components/ui/button";
import { useLang, useT } from "~/lib/i18n";

export function NotFound() {
  const lang = useLang();
  const t = useT();
  return <section className="container-page py-24 text-center">
    <p className="text-sm font-semibold uppercase tracking-widest text-flag-500">404</p>
    <h1 className="mt-3 text-3xl font-bold">{t.notFound.title}</h1>
    <p className="mt-3 text-muted">{t.notFound.text}</p>
    <Link to="/$lang" params={{ lang }} className={buttonClass("primary", "md", "mt-8")}>{t.notFound.home}</Link>
  </section>;
}
