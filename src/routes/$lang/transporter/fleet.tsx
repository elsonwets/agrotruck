import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Search, UserRound } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { FleetMap, type MapMarker } from "~/components/fleet/fleet-map";
import { ProgressBar } from "~/components/fleet/progress-bar";
import { FleetStatusBadge } from "~/components/fleet/status-badge";
import { SessionGate } from "~/components/session-gate";
import { buttonClass } from "~/components/ui/button";
import { Card, EmptyState, PageTitle, Tabs } from "~/components/ui/card";
import { Input } from "~/components/ui/form";
import { cn } from "~/lib/cn";
import { useLang, useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";
import { useNow } from "~/lib/use-now";
import { DISPLAY_STATUSES, isStale, type DisplayStatus } from "~/shared/fleet";

type FleetTruck = FunctionReturnType<typeof api.fleet.overview>[number];

export const Route = createFileRoute("/$lang/transporter/fleet")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["transporter"]}><FleetPage /></SessionGate>,
});

// Tableau de bord du transporteur Pro : compteurs, liste des véhicules et carte des positions.
function FleetPage() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const access = useQuery(api.fleet.access, { token });
  const trucks = useQuery(api.fleet.overview, access?.fleet ? { token } : "skip");
  const now = useNow();
  const [filter, setFilter] = useState<"all" | DisplayStatus>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "map">("list");

  // Numéro d'un camion = son rang dans toute la flotte : le même dans la liste et sur la carte, quel que soit le filtre.
  const numbered = useMemo(() => (trucks ?? []).map((truck, index) => ({ truck, label: String(index + 1) })), [trucks]);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return numbered.filter(({ truck }) => (filter === "all" || truck.status === filter)
      && (!needle || truck.name.toLowerCase().includes(needle) || (truck.plate ?? "").toLowerCase().includes(needle)));
  }, [numbered, filter, search]);
  const markers = useMemo<MapMarker[]>(() => shown.flatMap(({ truck, label }) => truck.position ? [{
    id: truck._id,
    label,
    lat: truck.position.lat,
    lng: truck.position.lng,
    title: truck.plate ? `${truck.name} · ${truck.plate}` : truck.name,
    detail: `${truck.driver?.name ?? t.fleet.noDriver} — ${t.fleet.lastSignal(t.fleet.ago(now - truck.position.at))}`,
    stale: isStale(truck.position.at, now),
  }] : []), [shown, now, t]);

  if (access === undefined) return <p className="text-muted">{t.common.loading}</p>;
  if (!access.fleet) return <EmptyState title={t.fleet.needTwoTrucks} text={t.fleet.needTwoTrucksText}
    action={<Link to="/$lang/transporter/trucks/new" params={{ lang }} className={buttonClass("primary")}>{t.transporter.addTruck}</Link>} />;

  const count = (status: DisplayStatus) => (trucks ?? []).filter((truck) => truck.status === status).length;
  const stats = [
    [t.fleet.stats.total, trucks?.length ?? 0],
    [t.fleet.stats.on_route, count("on_route")],
    [t.fleet.stats.available, count("available")],
    [t.fleet.stats.maintenance, count("maintenance")],
  ] as const;

  return <>
    <PageTitle title={t.fleet.title} intro={t.fleet.intro}
      actions={<Link to="/$lang/transporter/drivers" params={{ lang }} className={buttonClass("secondary", "sm")}><UserRound aria-hidden="true" />{t.fleet.driversTitle}</Link>} />

    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(([label, value]) => <Card key={label} className="p-4"><p className="text-sm text-muted">{label}</p><p className="mt-1 text-3xl font-bold text-ink">{value}</p></Card>)}
    </div>

    <div className="mt-6 flex flex-wrap items-center gap-3">
      <label className="relative w-full sm:max-w-xs">
        <span className="sr-only">{t.fleet.search}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.fleet.search} className="pl-9" />
      </label>
      <Tabs value={filter} onChange={setFilter} label={t.fleet.filterLabel}
        options={[["all", t.common.all] as const, ...DISPLAY_STATUSES.map((status) => [status, t.fleet.status[status]] as const)]} />
      <div className="lg:hidden">
        <Tabs value={view} onChange={setView} label={t.fleet.viewLabel} options={[["list", t.fleet.list], ["map", t.fleet.map]] as const} />
      </div>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className={cn("grid content-start gap-3", view === "map" && "hidden lg:grid")}>
        {trucks === undefined && <p className="text-muted">{t.common.loading}</p>}
        {shown.map(({ truck, label }) => <FleetRow key={truck._id} truck={truck} label={label} now={now} />)}
        {trucks && shown.length === 0 && <EmptyState title={t.fleet.noMatch} />}
      </div>
      <div className={cn("h-[65vh] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]", view === "list" && "hidden lg:block")}>
        <FleetMap markers={markers} label={t.fleet.map} className="size-full overflow-hidden rounded-[var(--radius-card)] border border-line" />
      </div>
    </div>
  </>;
}

function FleetRow({ truck, label, now }: { truck: FleetTruck; label: string; now: number }) {
  const t = useT();
  const stale = !truck.position || isStale(truck.position.at, now);
  const signal = !truck.position ? t.fleet.noSignal : stale ? t.fleet.signalLost : t.fleet.lastSignal(t.fleet.ago(now - truck.position.at));
  return <Card className="p-4">
    <div className="flex items-start gap-3">
      <span className={cn("fleet-pin shrink-0", stale && "fleet-pin--stale")} aria-hidden="true">{label}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="truncate font-semibold text-ink">{truck.name}{truck.plate && <span className="ml-2 text-sm font-normal text-muted">{truck.plate}</span>}</p>
          <FleetStatusBadge status={truck.status} />
        </div>
        <p className="mt-1 text-sm text-muted">{t.fleet.driver} : {truck.driver?.name ?? t.fleet.noDriver} · {signal}</p>
        {truck.mission && truck.progress !== null && <div className="mt-3"><ProgressBar value={truck.progress} from={truck.mission.pickupZone} to={truck.mission.dropoffZone} /></div>}
      </div>
    </div>
  </Card>;
}
