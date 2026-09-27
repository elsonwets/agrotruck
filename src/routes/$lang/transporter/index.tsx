import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { MapPin } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MissionCard } from "~/components/missions/parts";
import { SessionGate } from "~/components/session-gate";
import { Button, buttonClass } from "~/components/ui/button";
import { EmptyState, PageTitle } from "~/components/ui/card";
import { FormMessage } from "~/components/ui/form";
import { useCachedQuery } from "~/lib/cached-query";
import { errorCode } from "~/lib/errors";
import { useLang, useT } from "~/lib/i18n";
import { isOnline } from "~/lib/outbox-client";
import { privateHead } from "~/lib/private-route";
import { useSession, useToken } from "~/lib/session";

export const Route = createFileRoute("/$lang/transporter/")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["transporter"]}><AvailableMissions /></SessionGate>,
});

function AvailableMissions() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const navigate = useNavigate();
  const { session } = useSession();
  const me = useQuery(api.users.me, { token });
  const { data: missions } = useCachedQuery(api.missions.available, { token }, `available:${session?.userId}`);
  const accept = useMutation(api.missions.act);
  const [busyId, setBusyId] = useState<Id<"missions"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // « Accepter » exige le réseau : on ne promet jamais une mission qui pourrait déjà être prise.
  const onAccept = async (missionId: Id<"missions">) => {
    if (!isOnline()) { setError(t.common.offlineAction); return; }
    setBusyId(missionId);
    setError(null);
    try {
      await accept({ token, missionId, action: "accept" });
      void navigate({ to: "/$lang/transporter/missions/$missionId", params: { lang, missionId } });
    } catch (reason) {
      const code = errorCode(reason);
      setError(code ? t.errors[code] ?? t.common.genericError : t.common.offlineAction);
    } finally {
      setBusyId(null);
    }
  };

  const incomplete = me && (!me.workZones.length || !me.vehicleCategories.length);

  return <>
    <PageTitle title={t.transporter.availableTitle} intro={t.transporter.availableIntro} />
    {incomplete && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-harvest-300 bg-harvest-100 p-4">
      <p className="flex items-center gap-2 font-semibold"><MapPin className="size-5 text-brand-800" aria-hidden="true" />{t.transporter.completeProfile}</p>
      <Link to="/$lang/profile" params={{ lang }} className={buttonClass("primary", "sm")}>{t.transporter.completeProfileCta}</Link>
    </div>}
    {error && <div className="mt-4"><FormMessage>{error}</FormMessage></div>}
    <div className="mt-6 grid gap-3">
      {missions?.map((mission) => (
        <MissionCard key={mission._id} mission={mission} perspective="transporter" link={{ to: "/$lang/transporter/missions/$missionId", params: { lang, missionId: mission._id } }}>
          <Button size="sm" onClick={() => onAccept(mission._id)} disabled={busyId !== null}>{busyId === mission._id ? t.transporter.accepting : t.transporter.accept}</Button>
          <Link to="/$lang/transporter/missions/$missionId" params={{ lang, missionId: mission._id }} className={buttonClass("secondary", "sm")}>{t.transporter.details}</Link>
          {mission.producer && <span className="self-center text-sm text-muted">{mission.producer.name}</span>}
        </MissionCard>
      ))}
      {missions === undefined && <p className="text-muted">{t.common.loading}</p>}
      {missions?.length === 0 && !incomplete && <EmptyState title={t.transporter.noAvailable} />}
    </div>
  </>;
}
