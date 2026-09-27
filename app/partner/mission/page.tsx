"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SessionGate } from "@/components/auth/session-gate";
import { ContactCard, MissionFacts, MissionHistory, PendingSyncBadge } from "@/components/missions/mission-parts";
import { MissionStatusBadge } from "@/components/missions/mission-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { performOnlineAction, performQueueableAction, withQueuedActions } from "@/lib/mission-actions";
import { missionRoute } from "@/lib/missions";
import { useSession } from "@/lib/use-session";
import type { MissionView } from "@/types/order";

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
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!id || !session) return;
    fetch(`/.netlify/functions/orders?id=${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? (response.json() as Promise<MissionView>) : null))
      .then(async (data) => {
        if (!data) { setOrder(null); return; }
        const local = await withQueuedActions(data, session); // « chargé » / « livré » faits hors ligne
        setOrder(local.order);
        setPending(local.pending);
      }, () => setOrder(null));
  }, [id, session]);

  if (!id || order === null) return <Back><p className="mt-6 text-sm text-muted-foreground">Mission introuvable ou déjà prise par un autre transporteur.</p></Back>;
  if (order === undefined) return <Back><p className="mt-6 text-sm text-muted-foreground">Chargement…</p></Back>;

  const status = order.status ?? "pending";
  const mine = order.transporterAccountId === session?.accountId;
  const confirmedDelivery = order.events?.some((event) => event.type === "delivered" && event.accountId === session?.accountId);

  const act = async (action: "accept" | "loaded" | "delivered") => {
    if (!session) return;
    setBusy(true);
    setError(null);
    const outcome = action === "accept"
      ? await performOnlineAction(order, "accept", "accepter une mission")
      : await performQueueableAction(order, action, session, timeToday(time));
    setBusy(false);
    if (outcome.status === "error") { setError(outcome.message); return; }
    setOrder(outcome.order);
    setTime("");
    if (outcome.status === "queued") setPending((count) => count + 1);
  };

  const nextStep = mine && (status === "assigned" ? "loaded" : status === "loaded" || (status === "delivered" && !confirmedDelivery) ? "delivered" : null);

  return (
    <Back>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{missionRoute(order)}</h1>
        <div className="flex flex-wrap gap-1.5">{pending > 0 && <PendingSyncBadge />}<MissionStatusBadge status={order.status} perspective="transporter" /></div>
      </div>
      {pending > 0 && <p className="mt-3 text-sm text-muted-foreground">Enregistré sur le téléphone avec l&apos;heure de l&apos;action : ce sera envoyé automatiquement au retour du réseau.</p>}
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
