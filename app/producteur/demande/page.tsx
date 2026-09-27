"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SessionGate } from "@/components/auth/session-gate";
import { ContactCard, MissionFacts, MissionHistory } from "@/components/missions/mission-parts";
import { MissionStatusBadge } from "@/components/missions/mission-status-badge";
import { Button } from "@/components/ui/button";
import { missionRoute } from "@/lib/missions";
import { useSession } from "@/lib/use-session";
import type { MissionView } from "@/types/order";

type Action = "loaded" | "delivered" | "cancel";

function RequestDetail() {
  const id = useSearchParams().get("id");
  const { session } = useSession();
  const [order, setOrder] = useState<MissionView | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/.netlify/functions/orders?id=${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then(setOrder, () => setOrder(null));
  }, [id]);

  if (!id || order === null) return <Back><p className="mt-6 text-sm text-muted-foreground">Demande introuvable.</p></Back>;
  if (order === undefined) return <Back><p className="mt-6 text-sm text-muted-foreground">Chargement…</p></Back>;

  const status = order.status ?? "pending";
  const myId = session?.accountId;
  const confirmedDelivery = order.events?.some((event) => event.type === "delivered" && event.accountId === myId);

  const act = async (action: Action) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/.netlify/functions/orders?id=${encodeURIComponent(order.id)}&action=${action}`, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as MissionView & { error?: string };
      if (!response.ok) { setError(data.error ?? "Action impossible pour le moment."); return; }
      setOrder(data);
      setConfirmCancel(false);
    } catch {
      setError("Action impossible pour le moment. Vérifiez la connexion.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Back>
      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">{missionRoute(order)}</h1>
        <MissionStatusBadge status={order.status} />
      </div>

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
