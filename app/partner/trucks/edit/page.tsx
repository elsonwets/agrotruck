"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SessionGate } from "@/components/auth/session-gate";
import { TruckForm } from "@/components/partner/truck-form";
import type { Truck } from "@/types/truck";

function EditTruckForm() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const [truck, setTruck] = useState<Truck | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch("/.netlify/functions/trucks?mine=1").then((response) => response.json()).then((trucks: Truck[]) => setTruck(trucks.find((item) => item.id === id) ?? null));
  }, [id]);

  if (!truck) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  return <TruckForm truck={truck} onSaved={() => router.push("/partner?tab=camions")} />;
}

export default function EditTruckPage() {
  return (
    <SessionGate role="partner">
      <div className="page-shell max-w-2xl py-10">
        <h1 className="font-heading text-2xl font-bold">Modifier le camion</h1>
        <div className="mt-6"><Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}><EditTruckForm /></Suspense></div>
      </div>
    </SessionGate>
  );
}
