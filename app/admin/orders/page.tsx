"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { SessionGate } from "@/components/auth/session-gate";
import { MissionStatusBadge } from "@/components/missions/mission-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { zones, type Zone } from "@/data/zones";
import { filterOrders, formatDay, missionQuantity, missionRoute, orderStatus, ordersToCsv, type OrderFilters } from "@/lib/missions";
import { truckTypeLabels, type TruckType } from "@/types/truck";
import { orderStatusLabels, productTypeLabels, type MissionView, type OrderStatus, type ProductType } from "@/types/order";
import type { PublicAccount } from "@/types/account";

function MissionsAdmin() {
  const initialStatus = useSearchParams().get("status");
  const [orders, setOrders] = useState<MissionView[] | null>(null);
  const [partners, setPartners] = useState<PublicAccount[]>([]);
  const [filters, setFilters] = useState<OrderFilters>({ status: initialStatus && initialStatus in orderStatusLabels ? initialStatus as OrderStatus : undefined });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/.netlify/functions/orders").then((response) => (response.ok ? response.json() : [])).then(setOrders, () => setOrders([]));
  }, []);
  useEffect(() => {
    load();
    fetch("/.netlify/functions/auth?action=list-users&role=partner").then((response) => (response.ok ? response.json() : [])).then(setPartners, () => undefined);
  }, [load]);

  const set = (key: keyof OrderFilters) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((current) => ({ ...current, [key]: event.target.value || undefined }));
  const visible = filterOrders(orders ?? [], filters);
  const partnerNames = Object.fromEntries(partners.map((partner) => [partner.id, partner.companyName || partner.displayName]));

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([ordersToCsv(visible, partnerNames)], { type: "text/csv;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `missions-agrotrucks-${new Date().toISOString().slice(0, 10)}.csv` });
    link.click();
    URL.revokeObjectURL(url);
  };

  const act = async (order: MissionView, action: "assign" | "cancel", transporterAccountId?: string) => {
    setMessage(null);
    const response = await fetch(`/.netlify/functions/orders?id=${encodeURIComponent(order.id)}&action=${action}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transporterAccountId }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setMessage(response.ok ? { ok: true, text: action === "assign" ? "Transporteur assigné." : "Mission annulée." } : { ok: false, text: data.error ?? "Action impossible." });
    if (response.ok) load();
  };

  return (
    <div className="page-shell py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold">Missions</h1>
          <p className="mt-1 text-sm text-muted-foreground">{visible.length} mission{visible.length > 1 ? "s" : ""}{filters.from || filters.to ? ` · du ${filters.from ? formatDay(filters.from) : "début"} au ${filters.to ? formatDay(filters.to) : "aujourd'hui"}` : ""}</p>
        </div>
        <div data-print-hidden className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={!visible.length}><Download className="size-4" />Export CSV</Button>
          <Button variant="secondary" onClick={() => window.print()} disabled={!visible.length}><Printer className="size-4" />Export PDF</Button>
        </div>
      </div>

      <div data-print-hidden className="mt-6 grid gap-3 rounded-2xl border border-primary/10 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Filter id="filter-from" label="Du"><Input id="filter-from" type="date" className="h-10" value={filters.from ?? ""} onChange={set("from")} /></Filter>
        <Filter id="filter-to" label="Au"><Input id="filter-to" type="date" className="h-10" value={filters.to ?? ""} onChange={set("to")} /></Filter>
        <Filter id="filter-status" label="Statut">
          <Select id="filter-status" className="h-10" value={filters.status ?? ""} onChange={set("status")}>
            <option value="">Tous</option>
            {Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Filter>
        <Filter id="filter-product" label="Produit">
          <Select id="filter-product" className="h-10" value={filters.productType ?? ""} onChange={set("productType")}>
            <option value="">Tous</option>
            {(Object.keys(productTypeLabels) as ProductType[]).map((value) => <option key={value} value={value}>{productTypeLabels[value]}</option>)}
          </Select>
        </Filter>
        <Filter id="filter-pickup" label="Départ"><ZoneSelect id="filter-pickup" value={filters.pickupZone} onChange={set("pickupZone")} /></Filter>
        <Filter id="filter-dropoff" label="Arrivée"><ZoneSelect id="filter-dropoff" value={filters.dropoffZone} onChange={set("dropoffZone")} /></Filter>
      </div>

      {message && <p data-print-hidden className={`mt-4 text-sm ${message.ok ? "text-primary" : "text-danger"}`}>{message.text}</p>}

      <div className="mt-5 grid gap-3">
        {visible.map((order) => <MissionRow key={order.id} order={order} partners={partners} onAct={act} />)}
        {orders === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {orders !== null && visible.length === 0 && <p className="text-sm text-muted-foreground">Aucune mission pour ces filtres.</p>}
      </div>
    </div>
  );
}

function MissionRow({ order, partners, onAct }: { order: MissionView; partners: PublicAccount[]; onAct: (order: MissionView, action: "assign" | "cancel", transporterAccountId?: string) => void }) {
  const [choice, setChoice] = useState("");
  const status = orderStatus(order);
  const anonymous = !order.pickupZone;
  const active = partners.filter((partner) => !partner.disabled);
  const candidates = active.filter((partner) => order.candidateIds?.includes(partner.id));
  const others = active.filter((partner) => !order.candidateIds?.includes(partner.id));
  const name = (partner: PublicAccount) => partner.companyName || partner.displayName;

  return <div className="break-inside-avoid rounded-2xl border border-primary/10 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <p className="font-semibold">{missionRoute(order)}</p>
      <div className="flex flex-wrap gap-2">
        {anonymous && <span className="rounded-full border border-[#1f9d55]/30 px-2.5 py-1 text-[11px] font-semibold text-[#168548]">Demande WhatsApp</span>}
        <MissionStatusBadge status={order.status} />
      </div>
    </div>
    <p className="mt-1 text-sm text-foreground/80">
      {anonymous
        ? `${order.requestedTruckCount} × ${truckTypeLabels[order.truckType as TruckType] ?? order.truckType}`
        : `${order.productType ? productTypeLabels[order.productType] : ""}${missionQuantity(order) && ` · ${missionQuantity(order)}`}`}
      {` · le ${formatDay(order.neededFrom)} · créée le ${new Date(order.createdAt).toLocaleDateString("fr-FR")}`}
    </p>
    {order.cargoDescription && <p className="mt-1 text-sm text-muted-foreground">{order.cargoDescription}</p>}
    <p className="mt-2 text-sm"><span className="font-semibold text-primary">{order.clientName}</span> · {order.clientPhone}
      {order.transporter && <> · Transporteur : <span className="font-semibold">{order.transporter.name}</span> ({order.transporter.phone})</>}
    </p>

    {!anonymous && status === "pending" && <div data-print-hidden className="mt-4 flex flex-wrap items-center gap-2">
      {order.candidateIds?.length === 0 && <span className="w-full text-xs font-semibold text-danger">Aucun transporteur ne correspond (type + région) : assignez à la main.</span>}
      <Select aria-label="Transporteur à assigner" className="h-10 w-full sm:w-72" value={choice} onChange={(event) => setChoice(event.target.value)}>
        <option value="">Choisir un transporteur…</option>
        {candidates.length > 0 && <optgroup label="Correspondent (type + région)">{candidates.map((partner) => <option key={partner.id} value={partner.id}>{name(partner)}</option>)}</optgroup>}
        {others.length > 0 && <optgroup label="Autres transporteurs">{others.map((partner) => <option key={partner.id} value={partner.id}>{name(partner)}</option>)}</optgroup>}
      </Select>
      <Button size="sm" disabled={!choice} onClick={() => onAct(order, "assign", choice)}>Assigner</Button>
    </div>}
    {!anonymous && (status === "pending" || status === "assigned") && <div data-print-hidden className="mt-2"><Button size="sm" variant="ghost" onClick={() => onAct(order, "cancel")}>Annuler la mission</Button></div>}
  </div>;
}

function Filter({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div><Label htmlFor={id} className="mb-1 text-xs">{label}</Label>{children}</div>;
}

function ZoneSelect({ id, value, onChange }: { id: string; value?: Zone; onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void }) {
  return <Select id={id} className="h-10" value={value ?? ""} onChange={onChange}>
    <option value="">Toutes</option>
    {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
  </Select>;
}

export default function Page() {
  return <SessionGate role="admin"><Suspense fallback={<p className="page-shell py-10 text-sm text-muted-foreground">Chargement…</p>}><MissionsAdmin /></Suspense></SessionGate>;
}
