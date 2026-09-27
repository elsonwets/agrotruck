import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { SessionGate } from "~/components/session-gate";
import { TruckForm } from "~/components/trucks/truck-form";
import { Button } from "~/components/ui/button";
import { EmptyState, PageTitle } from "~/components/ui/card";
import { useLang, useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";

export const Route = createFileRoute("/$lang/transporter/trucks/$truckId")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["transporter"]}><EditTruck /></SessionGate>,
});

function EditTruck() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const navigate = useNavigate();
  const { truckId } = Route.useParams();
  const trucks = useQuery(api.trucks.mine, { token });
  const remove = useMutation(api.trucks.remove);
  const [confirm, setConfirm] = useState(false);
  const truck = trucks?.find((item) => item._id === truckId);
  const toList = () => void navigate({ to: "/$lang/transporter/trucks", params: { lang } });

  if (trucks === undefined) return <p className="text-muted">{t.common.loading}</p>;
  if (!truck) return <EmptyState title={t.errors.not_found ?? ""} />;

  return <div className="mx-auto max-w-3xl">
    <PageTitle title={t.transporter.truckFormEdit} intro={truck.name} />
    <div className="mt-6"><TruckForm truck={truck} onSaved={toList} /></div>
    <div className="mt-8 border-t border-line pt-6">
      {confirm
        ? <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="danger" onClick={async () => { await remove({ token, truckId: truck._id }); toList(); }}>{t.transporter.confirmDelete}</Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>{t.common.cancel}</Button>
          </div>
        : <Button variant="ghost" className="text-[#a3201b]" onClick={() => setConfirm(true)}>{t.transporter.deleteTruck}</Button>}
    </div>
  </div>;
}
