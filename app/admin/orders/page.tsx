"use client";

import { useEffect, useState } from "react";
import { SessionGate } from "@/components/auth/session-gate";
import { truckTypeLabels, type TruckType } from "@/types/truck";
import type { Order } from "@/types/order";

function OrderHistory() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    fetch("/.netlify/functions/orders").then((response) => (response.ok ? response.json() : [])).then(setOrders, () => setOrders([]));
  }, []);

  return (
    <div className="page-shell py-10">
      <h1 className="font-heading text-3xl font-bold">Demandes clients</h1>
      <div className="mt-8 grid gap-4">
        {orders?.map((order) => (
          <div key={order.id} className="rounded-2xl border border-primary/10 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{order.requestedTruckCount} camion(s) — {truckTypeLabels[order.truckType as TruckType] ?? order.truckType}</p>
              <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString("fr-FR")}</p>
            </div>
            <p className="mt-1 text-sm text-foreground/80">{order.pickupLocation} → {order.dropoffLocation} · à partir du {order.neededFrom}</p>
            {order.cargoDescription && <p className="mt-1 text-sm text-muted-foreground">{order.cargoDescription}</p>}
            <p className="mt-2 text-sm font-semibold text-primary">{order.clientName} · {order.clientPhone}</p>
          </div>
        ))}
        {orders?.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande pour l&apos;instant.</p>}
      </div>
    </div>
  );
}

export default function Page() { return <SessionGate role="admin"><OrderHistory /></SessionGate>; }
