import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Download, Printer } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MissionCard, missionQuantity, missionRoute, type MissionView } from "~/components/missions/parts";
import { SessionGate } from "~/components/session-gate";
import { Button } from "~/components/ui/button";
import { Card, EmptyState, PageTitle } from "~/components/ui/card";
import { Field, FormMessage, Input, Select } from "~/components/ui/form";
import { errorMessage } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";
import { MISSION_STATUSES, PRODUCT_TYPES, type MissionStatus, type ProductType } from "~/shared/domain";
import { filterMissions, toCsv, type MissionFilters } from "~/shared/missions";
import { zoneLabels, zones, type Zone } from "~/shared/zones";

export const Route = createFileRoute("/$lang/admin/missions")({
  validateSearch: (search: Record<string, unknown>): { status?: MissionStatus } => ({
    status: MISSION_STATUSES.includes(search.status as MissionStatus) ? (search.status as MissionStatus) : undefined,
  }),
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["admin"]}><AdminMissions /></SessionGate>,
});

type AdminMission = MissionView & { candidateIds?: Id<"users">[] };

function AdminMissions() {
  const t = useT();
  const token = useToken();
  const missions = useQuery(api.missions.adminList, { token });
  const transporters = useQuery(api.users.list, { token, role: "transporter" });
  const [filters, setFilters] = useState<MissionFilters>({ status: Route.useSearch().status });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (key: keyof MissionFilters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters({ ...filters, [key]: event.target.value || undefined });
  const visible = filterMissions(missions ?? [], filters);

  const exportCsv = () => {
    const rows = visible.map((mission) => [
      new Date(mission.createdAt).toISOString().slice(0, 10), t.missionStatus[mission.status], t.products[mission.productType],
      mission.quantitySacks, mission.quantityKg, zoneLabels[mission.pickupZone], mission.pickupLocation, zoneLabels[mission.dropoffZone], mission.dropoffLocation,
      mission.neededFrom, mission.vehicleCategory === "any" ? t.categories.any : t.categories[mission.vehicleCategory].label,
      mission.producer?.name, mission.producer?.phone, mission.transporter?.name, mission.transporter?.phone, mission.agreedPrice, mission.comment,
    ]);
    const url = URL.createObjectURL(new Blob([toCsv([t.admin.csvHeader, ...rows])], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `agrotrucks-missions-${new Date().toISOString().slice(0, 10)}.csv` });
    link.click();
    URL.revokeObjectURL(url);
  };

  return <>
    <PageTitle title={t.admin.missionsTitle} intro={`${visible.length}`} actions={
      <div data-print-hidden className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={exportCsv} disabled={!visible.length}><Download aria-hidden="true" />{t.admin.exportCsv}</Button>
        <Button variant="secondary" onClick={() => window.print()} disabled={!visible.length}><Printer aria-hidden="true" />{t.admin.exportPdf}</Button>
      </div>
    } />

    <Card data-print-hidden className="mt-6 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
      <Field id="filter-from" label={t.admin.from}><Input id="filter-from" type="date" className="min-h-10" value={filters.from ?? ""} onChange={set("from")} /></Field>
      <Field id="filter-to" label={t.admin.to}><Input id="filter-to" type="date" className="min-h-10" value={filters.to ?? ""} onChange={set("to")} /></Field>
      <Field id="filter-status" label={t.admin.status}>
        <Select id="filter-status" className="min-h-10" value={filters.status ?? ""} onChange={set("status")}>
          <option value="">{t.common.all}</option>
          {MISSION_STATUSES.map((status) => <option key={status} value={status}>{t.missionStatus[status]}</option>)}
        </Select>
      </Field>
      <Field id="filter-product" label={t.producer.product}>
        <Select id="filter-product" className="min-h-10" value={filters.productType ?? ""} onChange={set("productType")}>
          <option value="">{t.common.all}</option>
          {PRODUCT_TYPES.map((product) => <option key={product} value={product as ProductType}>{t.products[product]}</option>)}
        </Select>
      </Field>
      <Field id="filter-pickup" label={t.admin.pickupZone}><ZoneSelect id="filter-pickup" value={filters.pickupZone} onChange={set("pickupZone")} /></Field>
      <Field id="filter-dropoff" label={t.admin.dropoffZone}><ZoneSelect id="filter-dropoff" value={filters.dropoffZone} onChange={set("dropoffZone")} /></Field>
    </Card>

    {message && <div className="mt-4"><FormMessage tone={message.ok ? "success" : "error"}>{message.text}</FormMessage></div>}

    <div className="mt-5 grid gap-3">
      {visible.map((mission) => <AdminMissionRow key={mission._id} mission={mission} transporters={transporters ?? []} onDone={setMessage} />)}
      {missions === undefined && <p className="text-muted">{t.common.loading}</p>}
      {missions && visible.length === 0 && <EmptyState title={t.admin.noResults} />}
    </div>
  </>;
}

function ZoneSelect({ id, value, onChange }: { id: string; value?: Zone; onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void }) {
  const t = useT();
  return <Select id={id} className="min-h-10" value={value ?? ""} onChange={onChange}>
    <option value="">{t.common.all}</option>
    {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
  </Select>;
}

type Transporter = { _id: Id<"users">; displayName: string; companyName?: string; disabled: boolean };

function AdminMissionRow({ mission, transporters, onDone }: { mission: AdminMission; transporters: Transporter[]; onDone: (message: { ok: boolean; text: string }) => void }) {
  const t = useT();
  const token = useToken();
  const act = useMutation(api.missions.act);
  const [choice, setChoice] = useState("");
  const active = transporters.filter((transporter) => !transporter.disabled);
  const candidates = active.filter((transporter) => mission.candidateIds?.includes(transporter._id));
  const others = active.filter((transporter) => !mission.candidateIds?.includes(transporter._id));
  const name = (transporter: Transporter) => transporter.companyName || transporter.displayName;

  const run = async (action: "assign" | "cancel") => {
    try {
      await act({ token, missionId: mission._id, action, ...(action === "assign" ? { transporterId: choice as Id<"users"> } : {}) });
      onDone({ ok: true, text: `${missionRoute(mission)} — ${action === "assign" ? t.missionEvents.assigned : t.missionEvents.cancelled}` });
    } catch (error) {
      onDone({ ok: false, text: errorMessage(error, t) });
    }
  };

  return <MissionCard mission={mission}>
    <p className="w-full text-sm">
      <span className="font-semibold text-brand-800">{mission.producer?.name}</span> {mission.producer?.phone}
      {mission.transporter && <> · {t.producer.transporter} : <span className="font-semibold">{mission.transporter.name}</span> {mission.transporter.phone}</>}
      <span className="text-muted"> · {t.common.date(mission.createdAt)} · {missionQuantity(mission, t)}</span>
    </p>
    {mission.status === "pending" && <div data-print-hidden className="flex w-full flex-wrap items-center gap-2">
      {mission.candidateIds?.length === 0 && <p className="w-full text-sm font-semibold text-[#a3201b]">{t.admin.noCandidate}</p>}
      <Select aria-label={t.admin.chooseTransporter} className="min-h-10 w-full sm:w-72" value={choice} onChange={(event) => setChoice(event.target.value)}>
        <option value="">{t.admin.chooseTransporter}</option>
        {candidates.length > 0 && <optgroup label={t.admin.matching}>{candidates.map((transporter) => <option key={transporter._id} value={transporter._id}>{name(transporter)}</option>)}</optgroup>}
        {others.length > 0 && <optgroup label={t.admin.others}>{others.map((transporter) => <option key={transporter._id} value={transporter._id}>{name(transporter)}</option>)}</optgroup>}
      </Select>
      <Button size="sm" disabled={!choice} onClick={() => run("assign")}>{t.admin.assign}</Button>
    </div>}
    {(mission.status === "pending" || mission.status === "assigned") && <Button data-print-hidden size="sm" variant="ghost" onClick={() => run("cancel")}>{t.admin.cancelMission}</Button>}
  </MissionCard>;
}
