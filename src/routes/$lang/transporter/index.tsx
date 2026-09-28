import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { MapPin } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { MissionCard } from "~/components/missions/parts";
import { SessionGate } from "~/components/session-gate";
import { buttonClass } from "~/components/ui/button";
import { EmptyState, PageTitle } from "~/components/ui/card";
import { useCachedQuery } from "~/lib/cached-query";
import { useLang, useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useSession, useToken } from "~/lib/session";

export const Route = createFileRoute("/$lang/transporter/")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["transporter"]}><AvailableMissions /></SessionGate>,
});

// Missions de mes régions, pour mes types de véhicules : je propose mon prix, le producteur choisit.
function AvailableMissions() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const { session } = useSession();
  const me = useQuery(api.users.me, { token });
  const { data: missions } = useCachedQuery(api.missions.available, { token }, `available:${session?.userId}`);
  const incomplete = me && (!me.workZones.length || !me.vehicleCategories.length);

  return <>
    <PageTitle title={t.transporter.availableTitle} intro={t.transporter.availableIntro} />
    {incomplete && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-harvest-300 bg-harvest-100 p-4">
      <p className="flex items-center gap-2 font-semibold"><MapPin className="size-5 shrink-0 text-brand-800" aria-hidden="true" />{t.transporter.completeProfile}</p>
      <Link to="/$lang/profile" params={{ lang }} className={buttonClass("primary", "sm")}>{t.transporter.completeProfileCta}</Link>
    </div>}
    <div className="mt-6 grid gap-3">
      {missions?.map((mission) => {
        const offered = mission.myOffer?.status === "pending";
        return <MissionCard key={mission._id} mission={mission} perspective="transporter" link={{ to: "/$lang/transporter/missions/$missionId", params: { lang, missionId: mission._id } }}>
          <Link to="/$lang/transporter/missions/$missionId" params={{ lang, missionId: mission._id }} className={buttonClass(offered ? "secondary" : "primary", "sm")}>
            {offered ? t.offers.update : t.offers.makeOffer}
          </Link>
          {mission.producer && <span className="self-center text-sm text-muted">{mission.producer.name}</span>}
        </MissionCard>;
      })}
      {missions === undefined && <p className="text-muted">{t.common.loading}</p>}
      {missions?.length === 0 && !incomplete && <EmptyState title={t.transporter.noAvailable} />}
    </div>
  </>;
}
