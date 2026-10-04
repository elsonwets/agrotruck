import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ContactCard, MissionFacts, MissionHistory, PendingBadge, StatusBadge, missionRoute, type MissionView } from "~/components/missions/parts";
import { SharingPanel } from "~/components/fleet/sharing-panel";
import { SessionGate } from "~/components/session-gate";
import { Button } from "~/components/ui/button";
import { Card, EmptyState, PageTitle } from "~/components/ui/card";
import { OfferForm, TruckLine } from "~/components/missions/offers";
import { Field, FormMessage, Input } from "~/components/ui/form";
import { useCachedQuery } from "~/lib/cached-query";
import { useLang, useT } from "~/lib/i18n";
import { performQueueable, withQueuedActions } from "~/lib/mission-actions";
import { privateHead } from "~/lib/private-route";
import { useSession, useToken } from "~/lib/session";

export const Route = createFileRoute("/$lang/transporter/missions/$missionId")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["transporter"]}><TransporterMission /></SessionGate>,
});

// "14:30" → aujourd'hui à 14 h 30 (heure locale) ; vide = maintenant.
function timeToday(time: string): number {
  if (!time) return Date.now();
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.getTime();
}

function TransporterMission() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const { session } = useSession();
  const missionId = Route.useParams().missionId as Id<"missions">;
  const { data: server } = useCachedQuery(api.missions.get, { token, missionId }, `mission:${session?.userId}:${missionId}`);
  const [local, setLocal] = useState<{ mission: MissionView; pending: number } | null>(null);
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reportOwner = useMutation(api.tracking.reportFromOwner);

  useEffect(() => {
    if (!server || !session) return;
    let active = true;
    void withQueuedActions(server, session).then((result) => { if (active) setLocal(result.pending ? result : null); });
    return () => { active = false; };
  }, [server, session]);

  const back = <Link to="/$lang/transporter/missions" params={{ lang }} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft className="size-4" aria-hidden="true" />{t.transporter.myMissions}</Link>;
  if (server === undefined) return <>{back}<p className="mt-6 text-muted">{t.common.loading}</p></>;
  if (server === null || !session) return <>{back}<div className="mt-6"><EmptyState title={t.transporter.notFound} /></div></>;

  const mission = local?.mission ?? server;
  const mine = mission.transporterId === session.userId;
  const confirmed = mission.events.some((event) => event.type === "delivered" && event.userId === session.userId);
  const next = mine ? (mission.status === "assigned" ? "loaded" : mission.status === "loaded" || (mission.status === "delivered" && !confirmed) ? "delivered" : null) : null;
  // Transporteur particulier : il partage sa position depuis son compte tant que sa mission est en cours.
  const shareTruckId = mine && (mission.status === "assigned" || mission.status === "loaded") ? mission.truck?._id : undefined;

  const act = async (action: "loaded" | "delivered") => {
    setBusy(true);
    setError(null);
    const outcome = await performQueueable(token, mission, action, session, `${t.missionEvents[action]} — ${missionRoute(mission)}`, timeToday(time));
    setBusy(false);
    if (outcome.status === "error") { setError(outcome.code ? t.errors[outcome.code] ?? t.common.genericError : t.common.genericError); return; }
    setTime("");
    if (outcome.status === "queued") setLocal({ mission: outcome.mission, pending: (local?.pending ?? 0) + 1 });
  };

  return <div className="mx-auto max-w-3xl">
    {back}
    <div className="mt-6"><PageTitle title={missionRoute(mission)} actions={<div className="flex gap-1.5">{local && <PendingBadge />}<StatusBadge status={mission.status} perspective="transporter" /></div>} /></div>
    {local && <p className="mt-3 text-sm text-muted">{t.producer.queuedNote}</p>}

    <div className="mt-6 grid gap-4">
      <MissionFacts mission={mission} />
      <ContactCard title={t.transporter.producer} contact={mission.producer} empty={t.transporter.producerHidden} />
      {mine && mission.truck && <Card className="p-5"><p className="mb-3 font-semibold text-muted">{t.offers.truck}</p><TruckLine truck={mission.truck} /></Card>}
      {shareTruckId && <Card className="p-5">
        <p className="font-semibold text-ink">{t.fleet.shareTitle}</p>
        <p className="mb-4 mt-1 text-sm text-muted">{t.fleet.shareIntro}</p>
        <SharingPanel send={(fix) => reportOwner({ token, truckId: shareTruckId, ...fix })} />
      </Card>}
      {/* Offre : à envoyer tant que le producteur n'a pas choisi ; « non retenue » s'il en a choisi une autre. */}
      {!mine && (mission.status === "pending" || mission.myOffer?.status === "declined") && <OfferForm mission={mission} />}
    </div>

    <div className="mt-6 grid gap-3">
      {next && <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field id="mission-time" label={t.transporter.time}><Input id="mission-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></Field>
        <Button size="lg" onClick={() => act(next)} disabled={busy}>{next === "loaded" ? t.transporter.loaded : mission.status === "delivered" ? t.producer.confirmDelivery : t.transporter.delivered}</Button>
      </Card>}
      {error && <FormMessage>{error}</FormMessage>}
    </div>

    <MissionHistory events={mission.events} myId={session.userId} />
  </div>;
}
