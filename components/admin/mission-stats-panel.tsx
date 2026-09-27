"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { missionStats } from "@/lib/missions";
import type { MissionView } from "@/types/order";

const currentMonth = () => new Date().toISOString().slice(0, 7);

// Indicateurs du mois : chiffres simples + barres CSS (léger sur Android bas de gamme).
export function MissionStatsPanel() {
  const [orders, setOrders] = useState<MissionView[] | null>(null);
  const [month, setMonth] = useState(currentMonth);

  useEffect(() => {
    fetch("/.netlify/functions/orders").then((response) => (response.ok ? response.json() : [])).then(setOrders, () => setOrders([]));
  }, []);

  const stats = missionStats(orders ?? [], month);
  const waiting = orders?.filter((order) => order.candidateIds !== undefined) ?? [];
  const orphans = waiting.filter((order) => order.candidateIds?.length === 0).length;
  const maxRoute = Math.max(1, ...stats.topRoutes.map((route) => route.count));

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="font-heading text-3xl font-bold">Tableau de bord</h1>
      <label className="text-sm font-semibold text-primary">Mois
        <Input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonth())} className="mt-1 h-10 w-44" />
      </label>
    </div>

    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Missions" value={stats.missions} />
      <Tile label="Tonnes livrées" value={stats.tonnes.toLocaleString("fr-FR")} />
      <Tile label="Transporteurs actifs" value={stats.activeTransporters} />
      <Tile label="Missions livrées" value={stats.delivered} />
    </div>

    {waiting.length > 0 && <Link href="/admin/orders?status=pending" className="focus-ring mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-warning bg-warning/10 p-4 text-sm font-semibold">
      <span>{waiting.length} mission{waiting.length > 1 ? "s" : ""} en attente d&apos;un transporteur{orphans ? ` · ${orphans} sans transporteur possible` : ""}</span>
      <span className="text-primary">Assigner →</span>
    </Link>}

    <div className="mt-6 rounded-2xl border border-primary/10 bg-white p-5">
      <h2 className="font-heading text-lg font-semibold">Principaux axes</h2>
      {stats.topRoutes.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{orders === null ? "Chargement…" : "Aucune mission ce mois-ci."}</p>}
      <ul className="mt-4 grid gap-3">
        {stats.topRoutes.map(({ route, count }) => (
          <li key={route} className="grid gap-1.5 text-sm sm:grid-cols-[200px_1fr_auto] sm:items-center sm:gap-3">
            <span className="font-semibold">{route}</span>
            <span className="h-3 overflow-hidden rounded-full bg-primary/8"><span className="block h-full rounded-full bg-primary" style={{ width: `${(count / maxRoute) * 100}%` }} /></span>
            <span className="text-muted-foreground">{count} mission{count > 1 ? "s" : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  </section>;
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-2xl border border-primary/10 bg-white p-4">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-2 font-heading text-3xl font-bold text-primary">{value}</p>
  </div>;
}
