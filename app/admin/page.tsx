"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SessionGate } from "@/components/auth/session-gate";
import { availabilityLabels } from "@/types/truck";
import type { Truck } from "@/types/truck";

const ORDER: Record<Truck["availability"], number> = { available: 0, in_transit: 1, maintenance: 2 };

function FleetView() {
  const [trucks, setTrucks] = useState<Truck[] | null>(null);

  useEffect(() => {
    fetch("/.netlify/functions/trucks?scope=fleet").then((response) => response.json()).then(setTrucks);
  }, []);

  const sorted = [...(trucks ?? [])].sort((a, b) => ORDER[a.availability] - ORDER[b.availability]);

  return (
    <div className="page-shell py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold">Flotte — Badora &amp; partenaires</h1>
        <div className="flex gap-3"><Link href="/admin/queue" className="focus-ring text-sm font-semibold text-primary">File de validation</Link><Link href="/admin/partners" className="focus-ring text-sm font-semibold text-primary">Partenaires</Link></div>
      </div>
      <div className="mt-8 grid gap-3">
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

export default function Page() { return <SessionGate role="admin"><FleetView /></SessionGate>; }
