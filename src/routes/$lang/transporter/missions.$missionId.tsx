import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ContactCard, MissionFacts, MissionHistory, PendingBadge, StatusBadge, missionRoute, type MissionView } from "~/components/missions/parts";
import { SessionGate } from "~/components/session-gate";
import { Button } from "~/components/ui/button";
import { Card, EmptyState, PageTitle } from "~/components/ui/card";
import { Field, FormMessage, Input } from "~/components/ui/form";
import { useCachedQuery } from "~/lib/cached-query";
import { errorCode } from "~/lib/errors";
import { useLang, useT } from "~/lib/i18n";
import { performQueueable, withQueuedActions } from "~/lib/mission-actions";
import { isOnline } from "~/lib/outbox-client";
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
  const { data: server } = useCachedQuery(api.missions.get, { token, missionId }, `mission:${missionId}`);
  const accept = useMutation(api.missions.act);
  const [local, setLocal] = useState<{ mission: MissionView; pending: number } | null>(null);
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const onAccept = async () => {
    if (!isOnline()) { setError(t.common.offlineAction); return; }
    setBusy(true);
    setError(null);
    try { await accept({ token, missionId, action: "accept" }); }
    catch (reason) { const code = errorCode(reason); setError(code ? t.errors[code] ?? t.common.genericError : t.common.offlineAction); }
    finally { setBusy(false); }
  };

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
    </div>

    <div className="mt-6 grid gap-3">
      {mission.status === "pending" && <Button size="lg" onClick={onAccept} disabled={busy}>{busy ? t.transporter.accepting : t.transporter.acceptMission}</Button>}
      {next && <Card className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field id="mission-time" label={t.transporter.time}><Input id="mission-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></Field>
        <Button size="lg" onClick={() => act(next)} disabled={busy}>{next === "loaded" ? t.transporter.loaded : mission.status === "delivered" ? t.producer.confirmDelivery : t.transporter.delivered}</Button>
      </Card>}
      {error && <FormMessage>{error}</FormMessage>}
    </div>

    <MissionHistory events={mission.events} myId={session.userId} />
  </div>;
}
