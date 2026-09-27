import { Link, createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { buttonClass } from "~/components/ui/button";
import { Badge } from "~/components/ui/card";
import { dictFor } from "~/i18n";
import { cn } from "~/lib/cn";
import { useLang, useT } from "~/lib/i18n";
import { seo } from "~/lib/seo";
import type { Lang } from "~/shared/domain";

export const Route = createFileRoute("/$lang/pricing")({
  head: ({ params }) => {
    const lang = params.lang as Lang;
    const t = dictFor(lang);
    return seo({ lang, path: "/pricing", title: t.meta.pricing.title, description: t.meta.pricing.description });
  },
  component: PricingPage,
});

// Pas de prix pour l'instant : tout est gratuit pendant le lancement, les offres pro sont annoncées « à venir ».
function PricingPage() {
  const lang = useLang();
  const t = useT();
  return <div className="container-page py-12 sm:py-16">
    <header className="mx-auto max-w-3xl text-center">
      <Badge tone="harvest" className="px-3 py-1.5 text-sm">{t.pricing.freeBadge}</Badge>
      <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">{t.pricing.title}</h1>
      <p className="mt-4 text-lg text-muted">{t.pricing.intro}</p>
    </header>

    <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {t.pricing.plans.map((plan) => (
        <section key={plan.name} className={cn("flex flex-col rounded-[var(--radius-card)] border bg-white p-6", plan.free ? "border-brand-800 ring-2 ring-brand-800" : "border-line")}>
          <h2 className="text-lg font-bold">{plan.name}</h2>
          <p className="mt-1 min-h-10 text-sm text-muted">{plan.audience}</p>
          <p className={cn("mt-5 text-2xl font-bold", plan.free ? "text-brand-800" : "text-muted")}>{plan.free ? t.common.free : t.pricing.soon}</p>
          <ul className="mt-5 grid gap-2.5 text-sm">
            {plan.features.map((feature) => <li key={feature} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />{feature}</li>)}
          </ul>
        </section>
      ))}
    </div>

    <p className="mx-auto mt-10 max-w-3xl text-center text-muted">{t.pricing.note}</p>
    <div className="mt-8 text-center">
      <Link to="/$lang/signup" params={{ lang }} className={buttonClass("primary", "lg")}>{t.pricing.cta}</Link>
    </div>
  </div>;
}
