"use client";

import { useEffect, useState } from "react";
import { SessionGate } from "@/components/auth/session-gate";
import { Button } from "@/components/ui/button";
import type { Truck } from "@/types/truck";

function ModerationQueue() {
  const [trucks, setTrucks] = useState<Truck[]>([]);

  const load = () => { fetch("/.netlify/functions/trucks?status=pending").then((response) => response.json()).then(setTrucks); };
  useEffect(load, []);

  const moderate = async (truck: Truck, action: "publish" | "reject") => {
    await fetch(`/.netlify/functions/trucks?id=${truck.id}&action=${action}`, { method: "POST" });
    setTrucks((current) => current.filter((item) => item.id !== truck.id));
  };

  return (
    <div className="page-shell py-12">
      <h1 className="font-heading text-3xl font-bold">File de validation</h1>
      <div className="mt-8 grid gap-4">
        {trucks.map((truck) => (
          <div key={truck.id} className="rounded-2xl border border-primary/10 bg-white p-5">
            <p className="font-semibold">{truck.name}</p>
            <p className="text-xs text-muted-foreground">{truck.ownerName} · {truck.location} · {truck.capacityTons} tonnes</p>
            <p className="mt-2 text-sm text-foreground/80">{truck.description}</p>
            <div className="mt-4 flex gap-3"><Button size="sm" onClick={() => moderate(truck, "publish")}>Publier</Button><Button size="sm" variant="secondary" onClick={() => moderate(truck, "reject")}>Refuser</Button></div>
          </div>
        ))}
        {trucks.length === 0 && <p className="text-sm text-muted-foreground">Rien en attente.</p>}
      </div>
    </div>
  );
}

export default function Page() { return <SessionGate role="admin"><ModerationQueue /></SessionGate>; }
