import { Link, createFileRoute } from "@tanstack/react-router";
import { Handshake, MapPin, Smartphone } from "lucide-react";
import { buttonClass } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { dictFor } from "~/i18n";
import { useLang, useT } from "~/lib/i18n";
import { organizationJsonLd, seo } from "~/lib/seo";
import type { Lang } from "~/shared/domain";
import { zones } from "~/shared/zones";

export const Route = createFileRoute("/$lang/about")({
  head: ({ params }) => {
    const lang = params.lang as Lang;
    const t = dictFor(lang);
    return seo({ lang, path: "/about", title: t.meta.about.title, description: t.meta.about.description, jsonLd: [organizationJsonLd(lang)] });
  },
  component: AboutPage,
});

const valueIcons = [Handshake, MapPin, Smartphone];

function AboutPage() {
  const lang = useLang();
  const t = useT();
  return <>
    <div className="container-page py-12 sm:py-16">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{t.about.title}</h1>
        <p className="mt-5 text-lg text-muted">{t.about.intro}</p>
      </header>

      <section className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[var(--radius-card)] bg-brand-800 p-8 text-white">
          <h2 className="text-2xl font-bold">{t.about.missionTitle}</h2>
          <p className="mt-4 text-lg text-white/85">{t.about.missionText}</p>
        </div>
        <div>
          <h2 className="text-xl font-bold">{t.about.valuesTitle}</h2>
          <div className="mt-4 grid gap-3">
            {t.about.values.map((value, index) => {
              const Icon = valueIcons[index]!;
              return <Card key={value.title} className="flex gap-4 p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-800"><Icon className="size-5" aria-hidden="true" /></span>
                <div><h3 className="font-semibold">{value.title}</h3><p className="mt-1 text-muted">{value.text}</p></div>
              </Card>;
            })}
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">{t.about.regionsTitle}</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {zones.map((zone) => <li key={zone.id}><Link to="/$lang" params={{ lang }} search={{ zone: zone.id }} className="inline-flex rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:border-brand-200">{zone.label}</Link></li>)}
        </ul>
      </section>
    </div>

    <section className="bg-harvest-100">
      <div className="container-page flex flex-col items-start justify-between gap-6 py-12 sm:flex-row sm:items-center">
        <div><h2 className="text-2xl font-bold">{t.about.ctaTitle}</h2><p className="mt-2 text-ink/75">{t.about.ctaText}</p></div>
        <Link to="/$lang/signup" params={{ lang }} className={buttonClass("primary", "lg")}>{t.nav.signup}</Link>
      </div>
    </section>
  </>;
}
