"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SessionGate } from "@/components/auth/session-gate";
import { availabilityLabels } from "@/types/truck";
import type { Truck } from "@/types/truck";
import { Button } from "@/components/ui/button";

function PartnerDashboard() {
  const [trucks, setTrucks] = useState<Truck[] | null>(null);

  useEffect(() => {
    fetch("/.netlify/functions/trucks?mine=1").then((response) => response.json()).then(setTrucks);
  }, []);

  const availabilityOptions = ["available", "in_transit", "maintenance"] as const;

  const updateAvailability = async (truck: Truck, availability: (typeof availabilityOptions)[number]) => {
    const response = await fetch(`/.netlify/functions/trucks?id=${truck.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ availability }),
    });
    if (response.ok) setTrucks((current) => current?.map((item) => (item.id === truck.id ? { ...item, availability } : item)) ?? null);
  };

  return (
    <div className="page-shell py-12">
      <div className="flex items-center justify-between"><h1 className="font-heading text-3xl font-bold">Mes camions</h1><Button asChild><Link href="/partner/trucks/new">Ajouter un camion</Link></Button></div>
      <div className="mt-8 grid gap-4">
        {trucks?.map((truck) => (
          <div key={truck.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-white p-5">
            <div>
              <p className="font-semibold">{truck.name}</p>
              <p className="text-xs text-muted-foreground">Statut : {statusLabel(truck.listingStatus)}</p>
            </div>
            <div className="flex items-center gap-3">
              <select className="focus-ring h-10 rounded-lg border border-primary/15 px-2 text-sm" value={truck.availability} onChange={(event) => updateAvailability(truck, event.target.value as (typeof availabilityOptions)[number])}>
                {availabilityOptions.map((value) => <option key={value} value={value}>{availabilityLabels[value]}</option>)}
              </select>
              <Button asChild variant="secondary" size="sm"><Link href={`/partner/trucks/edit?id=${truck.id}`}>Modifier</Link></Button>
            </div>
          </div>
        ))}
        {trucks?.length === 0 && <p className="text-sm text-muted-foreground">Aucun camion pour l'instant.</p>}
      </div>
    </div>
  );
}

function statusLabel(status: Truck["listingStatus"]) {
  return { pending: "En attente de validation", published: "Publié", rejected: "Refusé" }[status];
}

export default function Page() { return <SessionGate role="partner"><PartnerDashboard /></SessionGate>; }
