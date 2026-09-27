"use client";

import { useEffect, useState } from "react";
import { FilterTabs, MissionCard } from "@/components/missions/mission-parts";
import { isFinished } from "@/lib/missions";
import type { Order } from "@/types/order";

export function MyMissions() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState<"current" | "finished">("current");

  useEffect(() => {
    fetch("/.netlify/functions/orders?scope=assigned").then((response) => (response.ok ? response.json() : [])).then(setOrders, () => setOrders([]));
  }, []);

  const visible = orders?.filter((order) => (tab === "finished") === isFinished(order));

  return <div>
    <h1 className="font-heading text-3xl font-bold">Mes missions</h1>
    <div className="mt-6"><FilterTabs value={tab} onChange={setTab} options={[["current", "À faire"], ["finished", "Terminées"]]} /></div>
    <div className="mt-5 grid gap-3">
      {visible?.map((order) => <MissionCard key={order.id} order={order} href={`/partner/mission?id=${order.id}`} perspective="transporter" />)}
      {orders === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {visible?.length === 0 && <p className="text-sm text-muted-foreground">{tab === "current" ? "Aucune mission en cours. Consultez les missions disponibles." : "Aucune mission terminée."}</p>}
    </div>
  </div>;
}
