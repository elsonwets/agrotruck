import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { SessionGate } from "~/components/session-gate";
import { Card, PageTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/form";
import { useLang, useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";
import { missionStats } from "~/shared/missions";

export const Route = createFileRoute("/$lang/admin/")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["admin"]}><Dashboard /></SessionGate>,
});

const currentMonth = () => new Date().toISOString().slice(0, 7);

// Indicateurs du mois : chiffres simples + barres CSS (léger sur Android bas de gamme).
function Dashboard() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const missions = useQuery(api.missions.adminList, { token });
  const [month, setMonth] = useState(currentMonth);
  const stats = missionStats(missions ?? [], month);
  const waiting = missions?.filter((mission) => mission.candidateIds !== undefined) ?? [];
  const orphans = waiting.filter((mission) => mission.candidateIds?.length === 0).length;
  const maxRoute = Math.max(1, ...stats.topRoutes.map((route) => route.count));

  const tiles = [
    [t.admin.missions, stats.missions],
    [t.admin.tonnes, stats.tonnes.toLocaleString(t.locale)],
    [t.admin.activeTransporters, stats.activeTransporters],
    [t.admin.delivered, stats.delivered],
  ] as const;

  return <>
    <PageTitle title={t.admin.dashboard} actions={
      <label className="text-sm font-semibold">{t.admin.month}
        <Input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonth())} className="mt-1 min-h-10 w-48" />
      </label>
    } />
    <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(([label, value]) => (
        <Card key={label} className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
          <p className="mt-2 text-3xl font-bold text-brand-800">{missions === undefined ? "…" : value}</p>
        </Card>
      ))}
    </div>

    {waiting.length > 0 && <Link to="/$lang/admin/missions" params={{ lang }} search={{ status: "pending" }}
      className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-harvest-300 bg-harvest-100 p-4 font-semibold">
      <span>{t.admin.waiting(waiting.length, orphans)}</span><span className="text-brand-800">{t.admin.assignCta} →</span>
    </Link>}

    <Card className="mt-6 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{t.admin.topRoutes}</h2>
      {stats.topRoutes.length === 0 && <p className="mt-2 text-muted">{missions === undefined ? t.common.loading : t.admin.noMissionsMonth}</p>}
      <ul className="mt-4 grid gap-3">
        {stats.topRoutes.map(({ route, count }) => (
          <li key={route} className="grid gap-1.5 text-sm sm:grid-cols-[220px_1fr_auto] sm:items-center sm:gap-4">
            <span className="font-semibold">{route}</span>
            <span className="h-3 overflow-hidden rounded-full bg-brand-50"><span className="block h-full rounded-full bg-brand-700" style={{ width: `${(count / maxRoute) * 100}%` }} /></span>
            <span className="text-muted">{count}</span>
          </li>
        ))}
      </ul>
    </Card>
  </>;
}
