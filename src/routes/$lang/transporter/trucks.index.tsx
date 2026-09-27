import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { SessionGate } from "~/components/session-gate";
import { buttonClass } from "~/components/ui/button";
import { Badge, Card, EmptyState, PageTitle } from "~/components/ui/card";
import { Select } from "~/components/ui/form";
import { VehicleIcon } from "~/components/vehicle-icon";
import { useLang, useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";
import { AVAILABILITIES, type Availability } from "~/shared/domain";
import { zoneLabels } from "~/shared/zones";

export const Route = createFileRoute("/$lang/transporter/trucks/")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["transporter"]}><MyTrucks /></SessionGate>,
});

function MyTrucks() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const trucks = useQuery(api.trucks.mine, { token });
  const setAvailability = useMutation(api.trucks.setAvailability);
  const add = <Link to="/$lang/transporter/trucks/new" params={{ lang }} className={buttonClass("primary", "lg")}><Plus aria-hidden="true" />{t.transporter.addTruck}</Link>;

  return <>
    <PageTitle title={t.transporter.trucksTitle} actions={add} />
    <div className="mt-6 grid gap-3">
      {trucks?.map((truck) => (
        <Card key={truck._id} className="flex flex-wrap items-center gap-4 p-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-brand-700">
            {truck.photoUrls[0] ? <img src={truck.photoUrls[0]} alt="" className="size-full object-cover" /> : <VehicleIcon category={truck.category} className="size-8" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{truck.name}</p>
            <p className="text-sm text-muted">{t.categories[truck.category].label} · {zoneLabels[truck.zone]} · {t.common.tonnes(truck.capacityTons)}</p>
            <div className="mt-1.5">{truck.hidden ? <Badge tone="danger">{t.transporter.hidden}</Badge> : <Badge tone="success">{t.transporter.published}</Badge>}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select aria-label={t.admin.status} value={truck.availability} className="min-h-10 w-44"
              onChange={(event) => void setAvailability({ token, truckId: truck._id, availability: event.target.value as Availability })}>
              {AVAILABILITIES.map((value) => <option key={value} value={value}>{t.availability[value]}</option>)}
            </Select>
            <Link to="/$lang/transporter/trucks/$truckId" params={{ lang, truckId: truck._id }} className={buttonClass("secondary", "sm")}>{t.common.edit}</Link>
            {!truck.hidden && <Link to="/$lang/trucks/$slug" params={{ lang, slug: truck.slug }} className={buttonClass("ghost", "sm")}>{t.transporter.viewListing}</Link>}
          </div>
        </Card>
      ))}
      {trucks === undefined && <p className="text-muted">{t.common.loading}</p>}
      {trucks?.length === 0 && <EmptyState title={t.transporter.noTrucks} action={add} />}
    </div>
  </>;
}
