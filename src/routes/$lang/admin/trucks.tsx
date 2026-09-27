import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { SessionGate } from "~/components/session-gate";
import { Button, buttonClass } from "~/components/ui/button";
import { Badge, Card, EmptyState, PageTitle } from "~/components/ui/card";
import { VehicleIcon } from "~/components/vehicle-icon";
import { useLang, useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";
import { zoneLabels } from "~/shared/zones";

export const Route = createFileRoute("/$lang/admin/trucks")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["admin"]}><AdminTrucks /></SessionGate>,
});

// Plus de validation préalable : l'admin peut seulement masquer une annonce abusive.
function AdminTrucks() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const trucks = useQuery(api.trucks.adminList, { token });
  const setHidden = useMutation(api.trucks.setHidden);

  return <>
    <PageTitle title={t.admin.trucksTitle} intro={trucks ? String(trucks.length) : undefined} />
    <div className="mt-6 grid gap-3">
      {trucks?.map((truck) => (
        <Card key={truck._id} className="flex flex-wrap items-center gap-4 p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><VehicleIcon category={truck.category} className="size-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{truck.name}</p>
            <p className="text-sm text-muted">{truck.ownerName} · {t.categories[truck.category].label} · {zoneLabels[truck.zone]} · {t.availability[truck.availability]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {truck.hidden ? <Badge tone="danger">{t.transporter.hidden}</Badge> : <Badge tone="success">{t.transporter.published}</Badge>}
            {truck.ownerDisabled && <Badge tone="danger">{t.admin.blocked}</Badge>}
            {!truck.hidden && <Link to="/$lang/trucks/$slug" params={{ lang, slug: truck.slug }} className={buttonClass("ghost", "sm")}>{t.transporter.viewListing}</Link>}
            <Button size="sm" variant={truck.hidden ? "primary" : "secondary"} onClick={() => void setHidden({ token, truckId: truck._id, hidden: !truck.hidden })}>
              {truck.hidden ? t.admin.show : t.admin.hide}
            </Button>
          </div>
        </Card>
      ))}
      {trucks === undefined && <p className="text-muted">{t.common.loading}</p>}
      {trucks?.length === 0 && <EmptyState title={t.transporter.noTrucks} />}
    </div>
  </>;
}
