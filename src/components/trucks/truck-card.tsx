import { Link } from "@tanstack/react-router";
import { MapPin, Scale, Star } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";
import { Badge } from "~/components/ui/card";
import { VehicleIcon } from "~/components/vehicle-icon";
import { useLang, useT } from "~/lib/i18n";
import { zoneLabels } from "~/shared/zones";

export type TruckCardData = FunctionReturnType<typeof api.trucks.list>[number];

const availabilityTone = { available: "success", in_transit: "harvest", maintenance: "danger" } as const;

export function TruckCard({ truck }: { truck: TruckCardData }) {
  const lang = useLang();
  const t = useT();
  return <article className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)] hover:border-brand-200">
    <Link to="/$lang/trucks/$slug" params={{ lang, slug: truck.slug }} className="relative block aspect-[16/10] bg-brand-50" tabIndex={-1} aria-hidden="true">
      {truck.photoUrl
        ? <img src={truck.photoUrl} alt="" loading="lazy" decoding="async" width={640} height={400} className="size-full object-cover" />
        : <span className="grid size-full place-items-center text-brand-200"><VehicleIcon category={truck.category} className="size-16" strokeWidth={1.3} /></span>}
      <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
        <Badge className="bg-white/95 text-brand-800">{t.modes[truck.listingMode]}</Badge>
        <Badge tone={availabilityTone[truck.availability]}>{t.availability[truck.availability]}</Badge>
      </span>
    </Link>
    <div className="flex flex-1 flex-col p-5">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
        <VehicleIcon category={truck.category} className="size-4" />{t.categories[truck.category].label}
      </p>
      <h3 className="mt-1.5 text-lg font-semibold leading-snug text-ink">
        <Link to="/$lang/trucks/$slug" params={{ lang, slug: truck.slug }} className="hover:text-brand-700">{truck.name}</Link>
      </h3>
      <p className="mt-0.5 text-sm text-muted">{truck.ownerName}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2"><MapPin className="size-4 shrink-0 text-brand-700" aria-hidden="true" /><dt className="sr-only">{t.truck.zone}</dt><dd className="truncate">{zoneLabels[truck.zone]}</dd></div>
        <div className="flex items-center gap-2"><Scale className="size-4 shrink-0 text-brand-700" aria-hidden="true" /><dt className="sr-only">{t.truck.capacity}</dt><dd>{t.common.tonnes(truck.capacityTons)}</dd></div>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
        {truck.rating
          ? <span className="flex items-center gap-1 font-semibold"><Star className="size-4 fill-harvest-400 text-harvest-400" aria-hidden="true" />{truck.rating.overall.toLocaleString(t.locale)}<span className="font-normal text-muted">· {t.truck.ratingCount(truck.rating.count)}</span></span>
          : <span className="text-muted">{t.truck.noRating}</span>}
        <Link to="/$lang/trucks/$slug" params={{ lang, slug: truck.slug }} className="font-semibold text-brand-700 hover:text-brand-900">{t.truck.details} →</Link>
      </div>
    </div>
  </article>;
}
