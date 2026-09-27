"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { MissionCard } from "@/components/missions/mission-parts";
import { Button } from "@/components/ui/button";
import type { PublicAccount } from "@/types/account";
import type { Order } from "@/types/order";

export function AvailableMissions() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [profile, setProfile] = useState<PublicAccount | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/.netlify/functions/orders?scope=available").then((response) => (response.ok ? response.json() : [])).then(setOrders, () => setOrders([]));
    fetch("/.netlify/functions/auth?action=profile").then((response) => (response.ok ? response.json() : null)).then(setProfile, () => undefined);
  }, []);

  const accept = async (order: Order) => {
    setBusyId(order.id);
    setError(null);
    try {
      const response = await fetch(`/.netlify/functions/orders?id=${encodeURIComponent(order.id)}&action=accept`, { method: "POST" });
      if (response.ok) { router.push(`/partner/mission?id=${order.id}`); return; }
      const { error: message } = (await response.json().catch(() => ({}))) as { error?: string };
      setError(message ?? "Impossible d'accepter cette mission.");
      // La mission a été prise par un autre transporteur : on la retire de la liste.
      if (response.status === 404 || response.status === 409) setOrders((current) => current?.filter((item) => item.id !== order.id) ?? null);
    } catch {
      setError("Connexion nécessaire pour accepter une mission.");
    } finally {
      setBusyId(null);
    }
  };

  const incompleteProfile = profile && !profile.workZones?.length;

  return <div>
    <h1 className="font-heading text-3xl font-bold">Missions disponibles</h1>
    <p className="mt-2 text-sm text-muted-foreground">Missions de vos régions, pour vos types de véhicules.</p>
    {incompleteProfile && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning bg-warning/10 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><MapPin className="size-4 text-primary" />Complétez votre profil : régions de chargement et véhicules.</p>
      <Button asChild size="sm"><Link href="/profil">Compléter mon profil</Link></Button>
    </div>}
    {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    <div className="mt-6 grid gap-3">
      {orders?.map((order) => (
        <MissionCard key={order.id} order={order} href={`/partner/mission?id=${order.id}`} perspective="transporter">
          <Button size="sm" onClick={() => accept(order)} disabled={busyId !== null}>{busyId === order.id ? "Acceptation…" : "Accepter"}</Button>
          <Button asChild size="sm" variant="secondary"><Link href={`/partner/mission?id=${order.id}`}>Détails</Link></Button>
        </MissionCard>
      ))}
      {orders === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {orders?.length === 0 && !incompleteProfile && <p className="text-sm text-muted-foreground">Aucune mission disponible pour le moment.</p>}
    </div>
  </div>;
}
