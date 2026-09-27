import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ClipboardList, PackageCheck, Truck } from "lucide-react";
import { Catalog, catalogQuery, validateCatalogSearch } from "~/components/trucks/catalog";
import { buttonClass } from "~/components/ui/button";
import { dictFor } from "~/i18n";
import { useLang, useT } from "~/lib/i18n";
import { organizationJsonLd, seo, websiteJsonLd } from "~/lib/seo";
import type { Lang } from "~/shared/domain";

export const Route = createFileRoute("/$lang/")({
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(catalogQuery(deps)),
  head: ({ params }) => {
    const lang = params.lang as Lang;
    const t = dictFor(lang);
    return seo({ lang, path: "", title: t.meta.home.title, description: t.meta.home.description, jsonLd: [organizationJsonLd(lang), websiteJsonLd(lang)] });
  },
  component: HomePage,
});

const stepIcons = [ClipboardList, Truck, PackageCheck];

function HomePage() {
  const lang = useLang();
  const t = useT();
  const search = Route.useSearch();

  return <>
    <section className="border-b border-line bg-white">
      <div className="container-page grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="inline-flex rounded-full bg-harvest-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-harvest-700">{t.home.eyebrow}</p>
          <h1 className="mt-5 max-w-2xl text-balance text-4xl font-bold leading-[1.1] tracking-tight text-ink sm:text-5xl">{t.home.title}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">{t.home.subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/$lang/signup" params={{ lang }} search={{ role: "producer" }} className={buttonClass("primary", "lg")}>{t.home.ctaProducer}</Link>
            <Link to="/$lang/signup" params={{ lang }} search={{ role: "transporter" }} className={buttonClass("secondary", "lg")}>{t.home.ctaTransporter}</Link>
          </div>
          <ul className="mt-8 grid gap-2.5 text-sm text-ink sm:grid-cols-3">
            {t.home.trust.map((item) => <li key={item} className="flex items-center gap-2"><CheckCircle2 className="size-5 shrink-0 text-brand-600" aria-hidden="true" />{item}</li>)}
          </ul>
        </div>
        <div className="hidden rounded-[var(--radius-card)] bg-brand-800 p-8 text-white lg:block">
          <p className="text-sm font-semibold uppercase tracking-wider text-harvest-300">{t.home.stepsTitle}</p>
          <ol className="mt-6 grid gap-6">
            {t.home.steps.map((step, index) => {
              const Icon = stepIcons[index]!;
              return <li key={step.title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-harvest-300"><Icon className="size-5" aria-hidden="true" /></span>
                <div><p className="font-semibold">{index + 1}. {step.title}</p><p className="mt-1 text-sm text-white/75">{step.text}</p></div>
              </li>;
            })}
          </ol>
        </div>
      </div>
    </section>

    <div className="container-page py-12 sm:py-14">
      <Catalog search={search} />
    </div>

    <section className="border-t border-line bg-white lg:hidden">
      <div className="container-page py-12">
        <h2 className="text-xl font-bold">{t.home.stepsTitle}</h2>
        <ol className="mt-6 grid gap-5">
          {t.home.steps.map((step, index) => {
            const Icon = stepIcons[index]!;
            return <li key={step.title} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-800"><Icon className="size-5" aria-hidden="true" /></span>
              <div><p className="font-semibold">{index + 1}. {step.title}</p><p className="mt-1 text-sm text-muted">{step.text}</p></div>
            </li>;
          })}
        </ol>
      </div>
    </section>

    <section className="bg-brand-800 text-white">
      <div className="container-page flex flex-col items-start justify-between gap-6 py-12 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold">{t.home.ctaBandTitle}</h2>
          <p className="mt-2 max-w-xl text-white/80">{t.home.ctaBandText}</p>
        </div>
        <Link to="/$lang/signup" params={{ lang }} search={{ role: "transporter" }} className={buttonClass("harvest", "lg")}>{t.home.ctaBandButton}</Link>
      </div>
    </section>
  </>;
}
