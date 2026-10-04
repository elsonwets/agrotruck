import { useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Truck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { SharingPanel } from "~/components/fleet/sharing-panel";
import { Card, EmptyState } from "~/components/ui/card";
import { useT } from "~/lib/i18n";
import type { FixPayload } from "~/lib/location-sharing";
import { privateHead } from "~/lib/private-route";
import { useNow } from "~/lib/use-now";

export const Route = createFileRoute("/$lang/track/$token")({
  head: ({ params }) => privateHead(params.lang),
  component: TrackPage,
});

// Page ouverte par le conducteur depuis WhatsApp : pas de compte, le lien suffit.
function TrackPage() {
  const t = useT();
  const { token } = Route.useParams();
  const info = useQuery(api.tracking.linkInfo, { linkToken: token });
  const report = useMutation(api.tracking.reportFromLink);
  const send = useCallback((fix: FixPayload) => report({ linkToken: token, ...fix }), [report, token]);
  const now = useNow(60_000);
  const valid = info && info.active && info.expiresAt > now;

  return <div className="container-page max-w-lg py-10">
    {info === undefined && <p className="text-muted">{t.common.loading}</p>}
    {info !== undefined && !valid && <EmptyState title={t.fleet.linkInvalid} />}
    {info && valid && <Card className="grid gap-5 p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">{t.fleet.trackTitle}</p>
        <h1 className="mt-1 text-2xl font-bold text-ink">{t.fleet.hello(info.driverName)}</h1>
        <p className="mt-2 flex items-center gap-2 text-muted"><Truck className="size-4 shrink-0" aria-hidden="true" />{info.truckName}{info.plate && ` · ${info.plate}`}</p>
      </div>
      <SharingPanel send={send} />
    </Card>}
  </div>;
}
