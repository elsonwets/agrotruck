"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SessionGate } from "@/components/auth/session-gate";
import { FilterTabs, MissionCard } from "@/components/missions/mission-parts";
import { Button } from "@/components/ui/button";
import { isFinished } from "@/lib/missions";
import type { Order } from "@/types/order";

function ProducerHome() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState<"current" | "finished">("current");

  useEffect(() => {
    fetch("/.netlify/functions/orders?scope=mine").then((response) => (response.ok ? response.json() : [])).then(setOrders, () => setOrders([]));
  }, []);

  const visible = orders?.filter((order) => (tab === "finished") === isFinished(order));

  return (
    <div className="page-shell py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-bold">Mes transports</h1>
        <Button asChild size="lg"><Link href="/producteur/demande/nouvelle"><Plus className="size-5" />Nouvelle demande de transport</Link></Button>
      </div>
      <div className="mt-8"><FilterTabs value={tab} onChange={setTab} options={[["current", "En cours"], ["finished", "Terminées"]]} /></div>
      <div className="mt-5 grid gap-3">
        {visible?.map((order) => <MissionCard key={order.id} order={order} href={`/producteur/demande?id=${order.id}`} perspective="producer" />)}
        {orders === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {visible?.length === 0 && <p className="text-sm text-muted-foreground">{tab === "current" ? "Aucune demande en cours." : "Aucune demande terminée."}</p>}
      </div>
    </div>
  );
}

export default function Page() { return <SessionGate role="producer"><ProducerHome /></SessionGate>; }
