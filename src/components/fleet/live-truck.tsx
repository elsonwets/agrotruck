import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FleetMap, type MapMarker } from "~/components/fleet/fleet-map";
import { ProgressBar } from "~/components/fleet/progress-bar";
import { Card } from "~/components/ui/card";
import { useT } from "~/lib/i18n";
import { useToken } from "~/lib/session";
import { useNow } from "~/lib/use-now";
import { isStale } from "~/shared/fleet";
import type { Zone } from "~/shared/zones";

// Pour le producteur, pendant la mission : position du camion, progression et conducteur.
export function LiveTruck({ missionId, from, to }: { missionId: Id<"missions">; from: Zone; to: Zone }) {
  const t = useT();
  const token = useToken();
  const live = useQuery(api.tracking.missionPosition, { token, missionId });
  const now = useNow();
  const position = live?.position ?? null;
  const markers = useMemo<MapMarker[]>(() => position ? [{
    id: "truck", label: "1", lat: position.lat, lng: position.lng, title: t.fleet.livePosition,
    detail: t.fleet.lastSignal(t.fleet.ago(now - position.at)), stale: isStale(position.at, now),
  }] : [], [position, now, t]);

  if (!live) return null;
  return <Card className="grid gap-4 p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-semibold text-muted">{t.fleet.livePosition}</p>
      {position && <span className="text-sm text-muted">{isStale(position.at, now) ? t.fleet.signalLost : t.fleet.lastSignal(t.fleet.ago(now - position.at))}</span>}
    </div>
    <ProgressBar value={live.progress} from={from} to={to} />
    {live.driverName && <p className="text-sm">{t.fleet.driver} : <span className="font-semibold">{live.driverName}</span></p>}
    {position
      ? <FleetMap markers={markers} label={t.fleet.livePosition} follow className="h-64 overflow-hidden rounded-xl border border-line" />
      : <p className="text-sm text-muted">{t.fleet.notShared}</p>}
  </Card>;
}
