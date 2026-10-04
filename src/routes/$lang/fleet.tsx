import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import type { FunctionReturnType } from "convex/server";
import { Scale, ShieldCheck, Star, UserRound } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { ProgressBar } from "~/components/fleet/progress-bar";
import { FleetStatusBadge } from "~/components/fleet/status-badge";
import { EmptyState, Tabs } from "~/components/ui/card";
import { VehicleIcon } from "~/components/vehicle-icon";
import { dictFor } from "~/i18n";
import { useLang, useT } from "~/lib/i18n";
import { seo } from "~/lib/seo";
import type { Lang } from "~/shared/domain";
import { DISPLAY_STATUSES, type DisplayStatus } from "~/shared/fleet";

const fleetQuery = convexQuery(api.fleet.publicList, {});
type PublicTruck = FunctionReturnType<typeof api.fleet.publicList>[number];

export const Route = createFileRoute("/$lang/fleet")({
  loader: ({ context }) => context.queryClient.ensureQueryData(fleetQuery),
  head: ({ params }) => {
    const lang = params.lang as Lang;
    const t = dictFor(lang);
    return seo({ lang, path: "/fleet", title: t.meta.fleet.title, description: t.meta.fleet.description });
  },
  component: PublicFleetPage,
});

// Statut des camions en temps réel. Aucune position : seul le producteur de la mission voit la carte.
function PublicFleetPage() {
  const t = useT();
  const { data: trucks } = useSuspenseQuery(fleetQuery);
  const [filter, setFilter] = useState<"all" | DisplayStatus>("all");
  const shown = trucks.filter((truck) => filter === "all" || truck.status === filter);

  return <div className="container-page py-12">
    <header className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-harvest-700">{t.fleet.publicEyebrow}</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t.fleet.publicTitle}</h1>
      <p className="mt-3 text-lg text-muted">{t.fleet.publicIntro}</p>
    </header>
    <div className="mt-8">
      <Tabs value={filter} onChange={setFilter} label={t.fleet.filterLabel}
        options={[["all", t.common.all] as const, ...DISPLAY_STATUSES.map((status) => [status, t.fleet.status[status]] as const)]} />
    </div>
    {shown.length > 0
      ? <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{shown.map((truck) => <LiveCard key={truck._id} truck={truck} />)}</div>
      : <div className="mt-6"><EmptyState title={t.fleet.publicEmpty} /></div>}
    <p className="mt-10 flex max-w-3xl items-start gap-2 text-sm text-muted"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />{t.fleet.privacyNote}</p>
  </div>;
}

function LiveCard({ truck }: { truck: PublicTruck }) {
  const lang = useLang();
  const t = useT();
  return <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-[var(--shadow-card)] hover:border-brand-200">
    <div className="flex items-start justify-between gap-3 p-5 pb-0">
      <div className="min-w-0">
        <h2 className="truncate font-semibold text-ink"><Link to="/$lang/trucks/$slug" params={{ lang, slug: truck.slug }} className="hover:text-brand-700">{truck.name}</Link></h2>
        {truck.plate && <p className="text-sm text-muted">{truck.plate}</p>}
      </div>
      <FleetStatusBadge status={truck.status} />
    </div>
    <div className="mx-5 mt-4 aspect-[16/9] overflow-hidden rounded-xl bg-brand-50">
      {truck.photoUrl
        ? <img src={truck.photoUrl} alt="" loading="lazy" decoding="async" width={640} height={360} className="size-full object-cover" />
        : <span className="grid size-full place-items-center text-brand-200"><VehicleIcon category={truck.category} className="size-14" strokeWidth={1.3} /></span>}
    </div>
    <div className="flex flex-1 flex-col gap-4 p-5">
      <p className="flex items-center gap-2 text-sm">
        <UserRound className="size-4 shrink-0 text-brand-700" aria-hidden="true" />
        <span className="text-muted">{t.fleet.driver}</span>
        <span className="font-semibold">{truck.driverName ?? t.fleet.noDriver}</span>
      </p>
      {truck.route && truck.progress !== null && <ProgressBar value={truck.progress} from={truck.route.pickupZone} to={truck.route.dropoffZone} />}
      <div className="mt-auto flex items-center justify-between border-t border-line pt-4 text-sm">
        <span className="flex items-center gap-1.5"><Scale className="size-4 text-brand-700" aria-hidden="true" />{t.common.tonnes(truck.capacityTons)}</span>
        {truck.rating
          ? <span className="flex items-center gap-1 font-semibold"><Star className="size-4 fill-harvest-400 text-harvest-400" aria-hidden="true" />{truck.rating.overall.toLocaleString(t.locale)}</span>
          : <span className="text-muted">{t.truck.noRating}</span>}
      </div>
    </div>
  </article>;
}
