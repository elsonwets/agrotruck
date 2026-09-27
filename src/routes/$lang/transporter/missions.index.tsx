import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../../../convex/_generated/api";
import { MissionCard } from "~/components/missions/parts";
import { SessionGate } from "~/components/session-gate";
import { EmptyState, PageTitle, Tabs } from "~/components/ui/card";
import { useCachedQuery } from "~/lib/cached-query";
import { useLang, useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useSession, useToken } from "~/lib/session";
import { isFinished } from "~/shared/missions";

export const Route = createFileRoute("/$lang/transporter/missions/")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["transporter"]}><MyMissions /></SessionGate>,
});

function MyMissions() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const { session } = useSession();
  const { data: missions } = useCachedQuery(api.missions.assigned, { token }, `assigned:${session?.userId}`);
  const [tab, setTab] = useState<"current" | "finished">("current");
  const visible = missions?.filter((mission) => (tab === "finished") === isFinished(mission));

  return <>
    <PageTitle title={t.transporter.myMissions} />
    <div className="mt-6"><Tabs label={t.transporter.myMissions} value={tab} onChange={setTab} options={[["current", t.space.toDo], ["finished", t.space.finished]]} /></div>
    <div className="mt-5 grid gap-3">
      {visible?.map((mission) => (
        <MissionCard key={mission._id} mission={mission} perspective="transporter" link={{ to: "/$lang/transporter/missions/$missionId", params: { lang, missionId: mission._id } }} />
      ))}
      {missions === undefined && <p className="text-muted">{t.common.loading}</p>}
      {visible?.length === 0 && <EmptyState title={tab === "current" ? t.transporter.noMissions : t.transporter.noFinished} />}
    </div>
  </>;
}
