import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SessionGate } from "~/components/session-gate";
import { TruckForm } from "~/components/trucks/truck-form";
import { PageTitle } from "~/components/ui/card";
import { useLang, useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";

export const Route = createFileRoute("/$lang/transporter/trucks/new")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["transporter"]}><NewTruck /></SessionGate>,
});

function NewTruck() {
  const lang = useLang();
  const t = useT();
  const navigate = useNavigate();
  return <div className="mx-auto max-w-3xl">
    <PageTitle title={t.transporter.truckFormNew} />
    <div className="mt-6"><TruckForm onSaved={() => void navigate({ to: "/$lang/transporter/trucks", params: { lang } })} /></div>
  </div>;
}
