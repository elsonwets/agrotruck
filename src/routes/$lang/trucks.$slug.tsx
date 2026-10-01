import { useState } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { ArrowLeft, Check, MapPin, MessageCircle, Phone, Scale, Star } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Badge, Card } from "~/components/ui/card";
import { buttonClass } from "~/components/ui/button";
import { RatingForm, criteria, type RatingSummary } from "~/components/trucks/rating-form";
import { VehicleIcon } from "~/components/vehicle-icon";
import { dictFor } from "~/i18n";
import { cn, telUrl, whatsappUrl } from "~/lib/cn";
import { useLang, useT } from "~/lib/i18n";
import { breadcrumbJsonLd, seo, SITE_URL } from "~/lib/seo";
import { useSession } from "~/lib/session";
import type { Lang } from "~/shared/domain";
import { zoneLabels } from "~/shared/zones";

const truckQuery = (slug: string) => convexQuery(api.trucks.bySlug, { slug });

export const Route = createFileRoute("/$lang/trucks/$slug")({
  loader: async ({ context, params }) => {
    const truck = await context.queryClient.ensureQueryData(truckQuery(params.slug));
    if (!truck) throw notFound();
    return truck;
  },
  head: ({ params, loaderData }) => {
    const lang = params.lang as Lang;
    const t = dictFor(lang);
    if (!loaderData) return {};
    const truck = loaderData;
    const category = t.categories[truck.category].label;
    const zone = zoneLabels[truck.zone];
    const url = `${SITE_URL}/${lang}/trucks/${truck.slug}`;
    return seo({
      lang,
      path: `/trucks/${truck.slug}`,
      title: t.meta.truck(truck.name, category, zone),
      description: t.meta.truckDescription(category, truck.capacityTons, zone, truck.ownerName),
      image: truck.photoUrls[0],
      type: "product",
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Vehicle",
          name: truck.name,
          url,
          vehicleConfiguration: category,
          ...(truck.brand ? { brand: { "@type": "Brand", name: truck.brand } } : {}),
          ...(truck.model ? { model: truck.model } : {}),
          ...(truck.photoUrls.length ? { image: truck.photoUrls } : {}),
          description: truck.description || undefined,
          ...(truck.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: truck.rating.overall, reviewCount: truck.rating.count, bestRating: 5, worstRating: 1 } } : {}),
        },
        breadcrumbJsonLd([{ name: t.meta.siteName, url: `${SITE_URL}/${lang}` }, { name: truck.name, url }]),
      ],
    });
  },
  component: TruckPage,
});

function TruckPage() {
  const lang = useLang();
  const t = useT();
  const { slug } = Route.useParams();
  const { data: truck } = useSuspenseQuery(truckQuery(slug));
  const [photo, setPhoto] = useState(0);
  if (!truck) return null;

  const facts = [
    { icon: <Scale />, label: t.truck.capacity, value: t.common.tonnes(truck.capacityTons) },
    { icon: <MapPin />, label: t.truck.zone, value: `${truck.location}, ${zoneLabels[truck.zone]}` },
    { icon: <VehicleIcon category={truck.category} />, label: t.producer.vehicle, value: t.categories[truck.category].label },
  ];

  return <div className="container-page py-8 sm:py-12">
    <Link to="/$lang" params={{ lang }} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"><ArrowLeft className="size-4" aria-hidden="true" />{t.truck.back}</Link>

    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
      <div>
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-brand-50">
          {truck.photoUrls.length
            ? <img src={truck.photoUrls[photo]} alt={truck.name} width={1200} height={750} className="aspect-[16/10] w-full object-cover" />
            : <div className="grid aspect-[16/10] place-items-center text-brand-200"><VehicleIcon category={truck.category} className="size-24" strokeWidth={1.2} /><span className="sr-only">{t.truck.noPhoto}</span></div>}
        </div>
        {truck.photoUrls.length > 1 && <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {truck.photoUrls.map((url, index) => (
            <button key={url} type="button" onClick={() => setPhoto(index)} aria-pressed={index === photo} aria-label={`${truck.name} ${index + 1}`}
              className={cn("overflow-hidden rounded-xl border-2", index === photo ? "border-brand-800" : "border-transparent")}>
              <img src={url} alt="" loading="lazy" width={160} height={100} className="aspect-[16/10] w-full object-cover" />
            </button>
          ))}
        </div>}

        <div className="mt-8 flex flex-wrap gap-2">
          <Badge tone="brand">{t.modes[truck.listingMode]}</Badge>
          <Badge tone={truck.availability === "available" ? "success" : truck.availability === "in_transit" ? "harvest" : "danger"}>{t.availability[truck.availability]}</Badge>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{truck.name}</h1>
        {(truck.brand || truck.model) && <p className="mt-1 text-muted">{[truck.brand, truck.model].filter(Boolean).join(" · ")}</p>}

        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="rounded-2xl border border-line bg-white p-4">
              <span className="text-brand-700 [&_svg]:size-5" aria-hidden="true">{fact.icon}</span>
              <dt className="mt-3 text-xs text-muted">{fact.label}</dt>
              <dd className="mt-0.5 font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {truck.description && <p className="mt-8 whitespace-pre-line text-lg leading-relaxed text-ink/85">{truck.description}</p>}

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <TagList title={t.truck.serviceZones} values={truck.serviceZones.map((zone) => zoneLabels[zone])} />
          <TagList title={t.truck.goods} values={truck.goods} />
        </div>

        <Ratings truckId={truck._id} rating={truck.rating} />
      </div>

      <aside>
        <Card className="sticky top-24 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t.truck.owner}</p>
          <p className="mt-1 text-xl font-semibold">{truck.ownerName}</p>
          <p className="mt-1 text-sm text-muted">{truck.ownerPhone}</p>
          <div className="mt-5 grid gap-2">
            <a href={telUrl(truck.ownerPhone)} className={buttonClass("primary", "lg")}><Phone aria-hidden="true" />{t.common.call}</a>
            <a href={whatsappUrl(truck.whatsapp, `${truck.name} — AgroTrucks`)} target="_blank" rel="noreferrer" className={buttonClass("whatsapp", "lg")}><MessageCircle aria-hidden="true" />{t.common.whatsapp}</a>
            <Link to="/$lang/producer/new" params={{ lang }} search={{ category: truck.category }} className={buttonClass("secondary", "lg")}>{t.truck.requestType}</Link>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted">{t.truck.contactHint}</p>
        </Card>
      </aside>
    </div>
  </div>;
}

function TagList({ title, values }: { title: string; values: string[] }) {
  if (!values.length) return null;
  return <section>
    <h2 className="text-lg font-semibold">{title}</h2>
    <ul className="mt-3 grid gap-2">{values.map((value) => <li key={value} className="flex items-center gap-2"><Check className="size-4 text-brand-600" aria-hidden="true" />{value}</li>)}</ul>
  </section>;
}

type Rating = RatingSummary;

function Ratings({ truckId, rating: initial }: { truckId: Id<"trucks">; rating: Rating }) {
  const t = useT();
  const lang = useLang();
  const { session } = useSession();
  const [rating, setRating] = useState(initial);

  return <section className="mt-10 border-t border-line pt-8" aria-labelledby="ratings-title">
    <h2 id="ratings-title" className="text-lg font-semibold">{t.truck.rating}</h2>
    {rating
      ? <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-brand-800 p-4 text-white"><p className="flex items-center gap-1.5 text-3xl font-bold"><Star className="size-6 fill-harvest-400 text-harvest-400" aria-hidden="true" />{rating.overall.toLocaleString(t.locale)}</p><p className="mt-1 text-sm text-white/75">{t.truck.ratingCount(rating.count)}</p></div>
          {criteria.map((key) => <div key={key} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-muted">{t.truck.criteria[key]}</p><p className="mt-1 text-xl font-semibold">{rating[key].toLocaleString(t.locale)} / 5</p></div>)}
        </div>
      : <p className="mt-2 text-muted">{t.truck.noRating}</p>}

    {session?.role === "producer"
      ? <RatingForm truckId={truckId} title={t.truck.rateTitle} onRated={setRating} />
      : !session && <p className="mt-4 text-sm text-muted"><Link to="/$lang/login" params={{ lang }} className="font-semibold text-brand-700 hover:underline">{t.nav.login}</Link> — {t.truck.rateLogin}</p>}
  </section>;
}
