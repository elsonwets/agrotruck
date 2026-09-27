"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SessionGate } from "@/components/auth/session-gate";
import { ContactCard, MissionFacts, MissionHistory, PendingSyncBadge } from "@/components/missions/mission-parts";
import { MissionStatusBadge } from "@/components/missions/mission-status-badge";
import { Button } from "@/components/ui/button";
import { performOnlineAction, performQueueableAction, withQueuedActions } from "@/lib/mission-actions";
import { missionRoute } from "@/lib/missions";
import { useSession } from "@/lib/use-session";
import type { MissionView } from "@/types/order";

function RequestDetail() {
  const id = useSearchParams().get("id");
  const { session } = useSession();
  const [order, setOrder] = useState<MissionView | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!id || !session) return;
    fetch(`/.netlify/functions/orders?id=${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? (response.json() as Promise<MissionView>) : null))
      .then(async (data) => {
        if (!data) { setOrder(null); return; }
        const local = await withQueuedActions(data, session); // actions faites hors ligne, pas encore envoyées
        setOrder(local.order);
        setPending(local.pending);
      }, () => setOrder(null));
  }, [id, session]);

  if (!id || order === null) return <Back><p className="mt-6 text-sm text-muted-foreground">Demande introuvable.</p></Back>;
  if (order === undefined) return <Back><p className="mt-6 text-sm text-muted-foreground">Chargement…</p></Back>;

  const status = order.status ?? "pending";
  const myId = session?.accountId;
  const confirmedDelivery = order.events?.some((event) => event.type === "delivered" && event.accountId === myId);

  const act = async (action: "loaded" | "delivered" | "cancel") => {
    if (!session) return;
    setBusy(true);
    setError(null);
    const outcome = action === "cancel"
      ? await performOnlineAction(order, "cancel", "annuler la demande")
      : await performQueueableAction(order, action, session);
    setBusy(false);
    if (outcome.status === "error") { setError(outcome.message); return; }
    setOrder(outcome.order);
    if (outcome.status === "queued") setPending((count) => count + 1);
    setConfirmCancel(false);
  };

  return (
    <Back>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{missionRoute(order)}</h1>
        <div className="flex flex-wrap gap-1.5">{pending > 0 && <PendingSyncBadge />}<MissionStatusBadge status={order.status} /></div>
      </div>
      {pending > 0 && <p className="mt-3 text-sm text-muted-foreground">Enregistré sur le téléphone : ce sera envoyé automatiquement au retour du réseau.</p>}

      <div className="mt-6"><MissionFacts order={order} /></div>

      <div className="mt-5"><ContactCard title="Transporteur" name={order.transporter?.name} phone={order.transporter?.phone}
        empty={status === "cancelled" ? "Demande annulée." : "En attente d'un transporteur. Vous serez mis en relation dès qu'un transporteur accepte."} /></div>

      <div className="mt-5 grid gap-2">
        {status === "assigned" && <Button onClick={() => act("loaded")} disabled={busy}>Marquer comme chargé</Button>}
        {(status === "loaded" || (status === "delivered" && !confirmedDelivery)) && <Button onClick={() => act("delivered")} disabled={busy}>{status === "delivered" ? "Confirmer la livraison" : "Marquer comme livré"}</Button>}
        {(status === "pending" || status === "assigned") && (confirmCancel
          ? <div className="grid gap-2 sm:grid-cols-2"><Button variant="danger" onClick={() => act("cancel")} disabled={busy}>Confirmer l&apos;annulation</Button><Button variant="ghost" onClick={() => setConfirmCancel(false)}>Garder la demande</Button></div>
          : <Button variant="ghost" onClick={() => setConfirmCancel(true)}>Annuler la demande</Button>)}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>

      <MissionHistory events={order.events} myId={myId} />
    </Back>
  );
}

function Back({ children }: { children: React.ReactNode }) {
  return <div className="page-shell max-w-2xl py-10">
    <Link href="/producteur" className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-primary/70 hover:text-primary"><ArrowLeft className="size-4" />Mes transports</Link>
    {children}
  </div>;
}

export default function Page() {
  return <SessionGate role="producer"><Suspense fallback={<p className="page-shell py-10 text-sm text-muted-foreground">Chargement…</p>}><RequestDetail /></Suspense></SessionGate>;
}
