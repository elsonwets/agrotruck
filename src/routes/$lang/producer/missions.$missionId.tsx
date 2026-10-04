import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LiveTruck } from "~/components/fleet/live-truck";
import { ContactCard, MissionFacts, MissionHistory, PendingBadge, StatusBadge, missionRoute, type MissionView } from "~/components/missions/parts";
import { SessionGate } from "~/components/session-gate";
import { Button } from "~/components/ui/button";
import { Card, EmptyState, PageTitle } from "~/components/ui/card";
import { OffersPanel, TruckLine } from "~/components/missions/offers";
import { FormMessage } from "~/components/ui/form";
import { useCachedQuery } from "~/lib/cached-query";
import { errorMessage } from "~/lib/errors";
import { useLang, useT } from "~/lib/i18n";
import { performQueueable, withQueuedActions } from "~/lib/mission-actions";
import { isOnline } from "~/lib/outbox-client";
import { privateHead } from "~/lib/private-route";
import { useSession, useToken } from "~/lib/session";

export const Route = createFileRoute("/$lang/producer/missions/$missionId")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["producer"]}><ProducerMission /></SessionGate>,
});

function ProducerMission() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const { session } = useSession();
  const missionId = Route.useParams().missionId as Id<"missions">;
  const { data: server } = useCachedQuery(api.missions.get, { token, missionId }, `mission:${session?.userId}:${missionId}`);
  const cancel = useMutation(api.missions.act);
  const [local, setLocal] = useState<{ mission: MissionView; pending: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Actions faites hors ligne et pas encore envoyées : réappliquées sur la version du serveur.
  useEffect(() => {
    if (!server || !session) return;
    let active = true;
    void withQueuedActions(server, session).then((result) => { if (active) setLocal(result.pending ? result : null); });
    return () => { active = false; };
  }, [server, session]);

  const back = <Link to="/$lang/producer" params={{ lang }} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft className="size-4" aria-hidden="true" />{t.producer.title}</Link>;
  if (server === undefined) return <>{back}<p className="mt-6 text-muted">{t.common.loading}</p></>;
  if (server === null || !session) return <>{back}<div className="mt-6"><EmptyState title={t.producer.notFound} /></div></>;

  const mission = local?.mission ?? server;
  const confirmedDelivery = mission.events.some((event) => event.type === "delivered" && event.userId === session.userId);

  const act = async (action: "loaded" | "delivered") => {
    setBusy(true);
    setError(null);
    const outcome = await performQueueable(token, mission, action, session, `${t.missionEvents[action]} — ${missionRoute(mission)}`);
    setBusy(false);
    if (outcome.status === "error") { setError(outcome.code ? t.errors[outcome.code] ?? t.common.genericError : t.common.genericError); return; }
    if (outcome.status === "queued") setLocal({ mission: outcome.mission, pending: (local?.pending ?? 0) + 1 });
  };

  const doCancel = async () => {
    if (!isOnline()) { setError(t.common.offlineAction); return; }
    setBusy(true);
    try { await cancel({ token, missionId, action: "cancel" }); setConfirmCancel(false); }
    catch (reason) { setError(errorMessage(reason, t)); }
    finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-3xl">
    {back}
    <div className="mt-6"><PageTitle title={missionRoute(mission)} actions={<div className="flex gap-1.5">{local && <PendingBadge />}<StatusBadge status={mission.status} /></div>} /></div>
    {local && <p className="mt-3 text-sm text-muted">{t.producer.queuedNote}</p>}

    <div className="mt-6 grid gap-4">
      <MissionFacts mission={mission} />
      {mission.status === "pending"
        ? <OffersPanel mission={mission} />
        : <>
            <ContactCard title={t.producer.transporter} contact={mission.transporter}
              empty={mission.status === "cancelled" ? t.missionStatus.cancelled : t.producer.waitingTransporter} />
            {mission.truck && <Card className="p-5"><p className="mb-3 font-semibold text-muted">{t.offers.truck}</p><TruckLine truck={mission.truck} /></Card>}
            {mission.truck && (mission.status === "assigned" || mission.status === "loaded") &&
              <LiveTruck missionId={mission._id} from={mission.pickupZone} to={mission.dropoffZone} />}
          </>}
    </div>

    <div className="mt-6 grid gap-2">
      {mission.status === "assigned" && <Button size="lg" onClick={() => act("loaded")} disabled={busy}>{t.producer.markLoaded}</Button>}
      {(mission.status === "loaded" || (mission.status === "delivered" && !confirmedDelivery)) &&
        <Button size="lg" onClick={() => act("delivered")} disabled={busy}>{mission.status === "delivered" ? t.producer.confirmDelivery : t.producer.markDelivered}</Button>}
      {(mission.status === "pending" || mission.status === "assigned") && (confirmCancel
        ? <div className="grid gap-2 sm:grid-cols-2"><Button variant="danger" onClick={doCancel} disabled={busy}>{t.producer.confirmCancel}</Button><Button variant="ghost" onClick={() => setConfirmCancel(false)}>{t.producer.keepRequest}</Button></div>
        : <Button variant="ghost" onClick={() => setConfirmCancel(true)}>{t.producer.cancelRequest}</Button>)}
      {error && <FormMessage>{error}</FormMessage>}
    </div>

    <MissionHistory events={mission.events} myId={session.userId} />
  </div>;
}
