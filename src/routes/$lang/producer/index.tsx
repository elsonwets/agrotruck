import { useCallback, useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { MissionCard } from "~/components/missions/parts";
import { SessionGate } from "~/components/session-gate";
import { buttonClass } from "~/components/ui/button";
import { EmptyState, PageTitle, Tabs } from "~/components/ui/card";
import { useCachedQuery } from "~/lib/cached-query";
import { useLang, useT } from "~/lib/i18n";
import { getOutbox, OUTBOX_EVENT } from "~/lib/outbox-client";
import { privateHead } from "~/lib/private-route";
import { useSession, useToken } from "~/lib/session";
import { isFinished } from "~/shared/missions";
import type { OutboxItem } from "~/shared/outbox";

export const Route = createFileRoute("/$lang/producer/")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["producer"]}><ProducerHome /></SessionGate>,
});

function ProducerHome() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const { session } = useSession();
  const { data: missions } = useCachedQuery(api.missions.mine, { token }, `mine:${session?.userId}`);
  const [queued, setQueued] = useState<OutboxItem[]>([]);
  const [tab, setTab] = useState<"current" | "finished">("current");

  const loadQueued = useCallback(() => {
    getOutbox()?.list().then((items) => setQueued(items.filter((item) => item.kind === "create")), () => undefined);
  }, []);
  useEffect(() => {
    loadQueued();
    window.addEventListener(OUTBOX_EVENT, loadQueued);
    return () => window.removeEventListener(OUTBOX_EVENT, loadQueued);
  }, [loadQueued]);

  const visible = missions?.filter((mission) => (tab === "finished") === isFinished(mission));

  return <>
    <PageTitle title={t.producer.title} actions={<Link to="/$lang/producer/new" params={{ lang }} className={buttonClass("primary", "lg")}><Plus aria-hidden="true" />{t.producer.newRequest}</Link>} />
    <div className="mt-8"><Tabs label={t.producer.title} value={tab} onChange={setTab} options={[["current", t.space.current], ["finished", t.space.finished]]} /></div>
    <div className="mt-5 grid gap-3">
      {tab === "current" && queued.map((item) => (
        <MissionCard key={item.id} pending mission={{ ...(item.args as object), status: "pending" } as Parameters<typeof MissionCard>[0]["mission"]} />
      ))}
      {visible?.map((mission) => (
        <MissionCard key={mission._id} mission={mission} link={{ to: "/$lang/producer/missions/$missionId", params: { lang, missionId: mission._id } }} />
      ))}
      {missions === undefined && <p className="text-muted">{t.common.loading}</p>}
      {visible?.length === 0 && !(tab === "current" && queued.length) && (
        <EmptyState title={tab === "current" ? t.producer.empty : t.producer.emptyFinished}
          action={tab === "current" ? <Link to="/$lang/producer/new" params={{ lang }} className={buttonClass("primary")}>{t.producer.newRequest}</Link> : undefined} />
      )}
    </div>
  </>;
}
