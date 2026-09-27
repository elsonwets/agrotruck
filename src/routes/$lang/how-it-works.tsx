import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronDown, WifiOff } from "lucide-react";
import { buttonClass } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { dictFor } from "~/i18n";
import { useLang, useT } from "~/lib/i18n";
import { seo } from "~/lib/seo";
import type { Lang } from "~/shared/domain";

export const Route = createFileRoute("/$lang/how-it-works")({
  head: ({ params }) => {
    const lang = params.lang as Lang;
    const t = dictFor(lang);
    return seo({
      lang, path: "/how-it-works", title: t.meta.howItWorks.title, description: t.meta.howItWorks.description,
      jsonLd: [{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: t.howItWorks.faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      }],
    });
  },
  component: HowItWorksPage,
});

function Steps({ title, steps, cta }: { title: string; steps: string[]; cta: React.ReactNode }) {
  return <Card className="p-6 sm:p-8">
    <h2 className="text-xl font-bold">{title}</h2>
    <ol className="mt-6 grid gap-4">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-800 text-sm font-bold text-white">{index + 1}</span>
          <p className="pt-1.5">{step}</p>
        </li>
      ))}
    </ol>
    <div className="mt-8">{cta}</div>
  </Card>;
}

function HowItWorksPage() {
  const lang = useLang();
  const t = useT();
  return <div className="container-page py-12 sm:py-16">
    <header className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{t.howItWorks.title}</h1>
      <p className="mt-4 text-lg text-muted">{t.howItWorks.intro}</p>
    </header>

    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      <Steps title={t.howItWorks.producerTitle} steps={t.howItWorks.producerSteps}
        cta={<Link to="/$lang/signup" params={{ lang }} search={{ role: "producer" }} className={buttonClass("primary")}>{t.home.ctaProducer}</Link>} />
      <Steps title={t.howItWorks.transporterTitle} steps={t.howItWorks.transporterSteps}
        cta={<Link to="/$lang/signup" params={{ lang }} search={{ role: "transporter" }} className={buttonClass("secondary")}>{t.home.ctaBandButton}</Link>} />
    </div>

    <section className="mt-6 flex gap-4 rounded-[var(--radius-card)] bg-brand-800 p-6 text-white sm:p-8">
      <WifiOff className="size-8 shrink-0 text-harvest-300" aria-hidden="true" />
      <div>
        <h2 className="text-xl font-bold">{t.howItWorks.offlineTitle}</h2>
        <p className="mt-2 max-w-3xl text-white/80">{t.howItWorks.offlineText}</p>
      </div>
    </section>

    <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="faq-title">
      <h2 id="faq-title" className="text-2xl font-bold">{t.howItWorks.faqTitle}</h2>
      <div className="mt-6 grid gap-3">
        {t.howItWorks.faq.map(({ q, a }) => (
          <details key={q} className="group rounded-2xl border border-line bg-white p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
              {q}<ChevronDown className="size-5 shrink-0 text-brand-700 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="mt-3 text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  </div>;
}
