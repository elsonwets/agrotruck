import { Badge } from "~/components/ui/card";
import { useT } from "~/lib/i18n";
import type { DisplayStatus } from "~/shared/fleet";

const tones = { available: "success", loading: "harvest", on_route: "brand", maintenance: "danger" } as const;

export function FleetStatusBadge({ status }: { status: DisplayStatus }) {
  const t = useT();
  return <Badge tone={tones[status]}>{t.fleet.status[status]}</Badge>;
}
