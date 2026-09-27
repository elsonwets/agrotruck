"use client";

import { useEffect, useState } from "react";
import { SessionGate } from "@/components/auth/session-gate";
import { MissionStatsPanel } from "@/components/admin/mission-stats-panel";
import { availabilityLabels } from "@/types/truck";
import type { Truck } from "@/types/truck";

const ORDER: Record<Truck["availability"], number> = { available: 0, in_transit: 1, maintenance: 2 };

function AdminDashboard() {
  const [trucks, setTrucks] = useState<Truck[] | null>(null);

  useEffect(() => {
    fetch("/.netlify/functions/trucks?scope=fleet").then((response) => (response.ok ? response.json() : [])).then(setTrucks, () => setTrucks([]));
  }, []);

  const sorted = [...(trucks ?? [])].sort((a, b) => ORDER[a.availability] - ORDER[b.availability]);

  return (
    <div className="page-shell py-10">
      <MissionStatsPanel />
      <h2 className="mt-12 font-heading text-2xl font-bold">Flotte — Badora &amp; partenaires</h2>
      <div className="mt-5 grid gap-3">
        {sorted.map((truck) => (
          <div key={truck.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-white p-4">
            <div>
              <p className="font-semibold">{truck.name}</p>
              <p className="text-xs text-muted-foreground">{truck.ownerName}{truck.companyName ? ` · ${truck.companyName}` : ""} · {truck.location}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${truck.availability === "available" ? "bg-primary/10 text-primary" : truck.availability === "in_transit" ? "bg-warning/15 text-[#9b7d00]" : "bg-danger/10 text-danger"}`}>{availabilityLabels[truck.availability]}</span>
          </div>
        ))}
        {trucks?.length === 0 && <p className="text-sm text-muted-foreground">Aucun camion enregistré.</p>}
      </div>
    </div>
  );
}

export default function Page() { return <SessionGate role="admin"><AdminDashboard /></SessionGate>; }
