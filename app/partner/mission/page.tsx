"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SessionGate } from "@/components/auth/session-gate";
import { ContactCard, MissionFacts, MissionHistory } from "@/components/missions/mission-parts";
import { MissionStatusBadge } from "@/components/missions/mission-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { missionRoute } from "@/lib/missions";
import { useSession } from "@/lib/use-session";
import type { MissionView } from "@/types/order";

type Action = "accept" | "loaded" | "delivered";

// "14:30" → date du jour à 14 h 30 (heure locale), en ISO ; vide = maintenant.
function timeToday(time: string): string | undefined {
  if (!time) return undefined;
  const date = new Date();
  const [hours, minutes] = time.split(":").map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function MissionDetail() {
  const id = useSearchParams().get("id");
  const { session } = useSession();
  const [order, setOrder] = useState<MissionView | null | undefined>(undefined);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/.netlify/functions/orders?id=${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setOrder, () => setOrder(null));
  }, [id]);

  if (!id || order === null) return <Back><p className="mt-6 text-sm text-muted-foreground">Mission introuvable ou déjà prise par un autre transporteur.</p></Back>;
  if (order === undefined) return <Back><p className="mt-6 text-sm text-muted-foreground">Chargement…</p></Back>;

  const status = order.status ?? "pending";
  const mine = order.transporterAccountId === session?.accountId;
  const confirmedDelivery = order.events?.some((event) => event.type === "delivered" && event.accountId === session?.accountId);

  const act = async (action: Action) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/.netlify/functions/orders?id=${encodeURIComponent(order.id)}&action=${action}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ at: action === "accept" ? undefined : timeToday(time) }),
      });
      const data = (await response.json().catch(() => ({}))) as MissionView & { error?: string };
      if (!response.ok) { setError(data.error ?? "Action impossible pour le moment."); return; }
      setOrder(data);
      setTime("");
    } catch {
      setError("Action impossible sans connexion. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const nextStep = mine && (status === "assigned" ? "loaded" : status === "loaded" || (status === "delivered" && !confirmedDelivery) ? "delivered" : null);

  return (
    <Back>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{missionRoute(order)}</h1>
        <MissionStatusBadge status={order.status} perspective="transporter" />
      </div>
      <div className="mt-6"><MissionFacts order={order} /></div>
      <div className="mt-5"><ContactCard title="Producteur" name={order.clientName} phone={order.clientPhone}
        empty="Le contact du producteur s'affiche après acceptation." /></div>

      <div className="mt-5 grid gap-3">
        {status === "pending" && <Button size="lg" onClick={() => act("accept")} disabled={busy}>{busy ? "Acceptation…" : "Accepter cette mission"}</Button>}
        {nextStep && <div className="grid gap-3 rounded-2xl border border-primary/10 bg-white p-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="mission-time">Heure (facultatif)</Label>
            <Input id="mission-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </div>
          <Button size="lg" onClick={() => act(nextStep)} disabled={busy}>{nextStep === "loaded" ? "J'ai chargé" : status === "delivered" ? "Confirmer la livraison" : "J'ai livré"}</Button>
        </div>}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <MissionHistory events={order.events} myId={session?.accountId} />
    </Back>
  );
}

function Back({ children }: { children: React.ReactNode }) {
  return <div className="page-shell max-w-2xl py-10">
    <Link href="/partner?tab=missions" className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-primary/70 hover:text-primary"><ArrowLeft className="size-4" />Mes missions</Link>
    {children}
  </div>;
}

export default function Page() {
  return <SessionGate role="partner"><Suspense fallback={<p className="page-shell py-10 text-sm text-muted-foreground">Chargement…</p>}><MissionDetail /></Suspense></SessionGate>;
}
