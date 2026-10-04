import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Copy, Plus, Send } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SessionGate } from "~/components/session-gate";
import { Button, buttonClass } from "~/components/ui/button";
import { Badge, Card, EmptyState, PageTitle } from "~/components/ui/card";
import { Field, FormMessage, Input, Select } from "~/components/ui/form";
import { errorMessage } from "~/lib/errors";
import { useLang, useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";
import { useNow } from "~/lib/use-now";
import { firstName, whatsappUrl } from "~/shared/fleet";

type Driver = FunctionReturnType<typeof api.drivers.list>[number];
interface TruckOption { id: Id<"trucks">; name: string }

export const Route = createFileRoute("/$lang/transporter/drivers")({
  head: ({ params }) => privateHead(params.lang),
  component: () => <SessionGate roles={["transporter"]}><DriversPage /></SessionGate>,
});

// Conducteurs de l'entreprise : ajout, affectation d'un véhicule, lien de suivi WhatsApp.
function DriversPage() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const access = useQuery(api.fleet.access, { token });
  const drivers = useQuery(api.drivers.list, access?.fleet ? { token } : "skip");
  const trucks = useQuery(api.trucks.mine, { token });
  const [adding, setAdding] = useState(false);

  if (access === undefined) return <p className="text-muted">{t.common.loading}</p>;
  if (!access.fleet) return <EmptyState title={t.fleet.needTwoTrucks} text={t.fleet.needTwoTrucksText}
    action={<Link to="/$lang/transporter/trucks/new" params={{ lang }} className={buttonClass("primary")}>{t.transporter.addTruck}</Link>} />;

  const truckOptions: TruckOption[] = (trucks ?? []).map((truck) => ({ id: truck._id, name: truck.plate ? `${truck.name} · ${truck.plate}` : truck.name }));

  return <div className="mx-auto max-w-3xl">
    <PageTitle title={t.fleet.driversTitle} intro={t.fleet.driversIntro}
      actions={!adding && <Button size="sm" onClick={() => setAdding(true)}><Plus aria-hidden="true" />{t.fleet.addDriver}</Button>} />
    {adding && <div className="mt-6"><DriverForm trucks={truckOptions} onDone={() => setAdding(false)} /></div>}
    <div className="mt-6 grid gap-3">
      {drivers === undefined && <p className="text-muted">{t.common.loading}</p>}
      {drivers?.map((driver) => <DriverCard key={driver._id} driver={driver} trucks={truckOptions} />)}
      {drivers?.length === 0 && !adding && <EmptyState title={t.fleet.noDrivers} />}
    </div>
  </div>;
}

function DriverForm({ driver, trucks, onDone }: { driver?: Driver; trucks: TruckOption[]; onDone: () => void }) {
  const t = useT();
  const token = useToken();
  const create = useMutation(api.drivers.create);
  const update = useMutation(api.drivers.update);
  const [name, setName] = useState(driver?.name ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [truckId, setTruckId] = useState<string>(driver?.truckId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const prefix = driver?._id ?? "new-driver";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const fields = { token, name, phone, truckId: truckId ? (truckId as Id<"trucks">) : undefined };
    try {
      if (driver) await update({ ...fields, driverId: driver._id });
      else await create(fields);
      onDone();
    } catch (reason) {
      setError(errorMessage(reason, t));
    } finally {
      setBusy(false);
    }
  };

  return <Card className="p-5">
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${prefix}-name`} label={t.fleet.driverName}><Input id={`${prefix}-name`} value={name} onChange={(event) => setName(event.target.value)} required /></Field>
        <Field id={`${prefix}-phone`} label={t.fleet.driverPhone}><Input id={`${prefix}-phone`} type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required /></Field>
      </div>
      <Field id={`${prefix}-truck`} label={t.fleet.assignedTruck}>
        <Select id={`${prefix}-truck`} value={truckId} onChange={(event) => setTruckId(event.target.value)}>
          <option value="">{t.fleet.noTruck}</option>
          {trucks.map((truck) => <option key={truck.id} value={truck.id}>{truck.name}</option>)}
        </Select>
      </Field>
      {error && <FormMessage>{error}</FormMessage>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>{busy ? t.common.saving : t.common.save}</Button>
        <Button variant="ghost" onClick={onDone}>{t.common.cancel}</Button>
      </div>
    </form>
  </Card>;
}

function DriverCard({ driver, trucks }: { driver: Driver; trucks: TruckOption[] }) {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const now = useNow(60_000);
  const createLink = useMutation(api.tracking.createLink);
  const revokeLink = useMutation(api.tracking.revokeLink);
  const setDisabled = useMutation(api.drivers.setDisabled);
  const [editing, setEditing] = useState(false);
  const [shared, setShared] = useState<{ url: string; whatsapp: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try { await action(); } catch (reason) { setError(errorMessage(reason, t)); } finally { setBusy(false); }
  };

  // Le lien s'ouvre ensuite par un vrai clic sur « Ouvrir WhatsApp » : un window.open après un await serait bloqué.
  const send = () => run(async () => {
    const { linkToken } = await createLink({ token, driverId: driver._id });
    const url = `${window.location.origin}/${lang}/track/${linkToken}`;
    setCopied(false);
    setShared({ url, whatsapp: whatsappUrl(driver.phone, t.fleet.whatsappMessage(firstName(driver.name), driver.truckName ?? "", url)) });
  });
  const copy = (url: string) => void navigator.clipboard?.writeText(url).then(() => setCopied(true)).catch(() => undefined);

  if (editing) return <DriverForm driver={driver} trucks={trucks} onDone={() => setEditing(false)} />;

  const expiresAt = driver.linkExpiresAt;
  const linkActive = expiresAt !== null && expiresAt > now;

  return <Card className="grid gap-4 p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{driver.name}</p>
        <p className="text-sm text-muted">{driver.phone} · {driver.truckName ?? t.fleet.noTruck}</p>
        <p className="mt-1 text-sm text-muted">{linkActive ? t.fleet.linkActive(t.common.dateTime(expiresAt)) : t.fleet.noLink}</p>
      </div>
      {driver.disabled && <Badge tone="danger">{t.fleet.disabled}</Badge>}
    </div>
    {shared && <div className="grid gap-2 rounded-xl border border-line bg-canvas p-3 sm:grid-cols-2">
      <a href={shared.whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClass("whatsapp")}><Send aria-hidden="true" />{t.fleet.openWhatsapp}</a>
      <Button variant="secondary" onClick={() => copy(shared.url)}><Copy aria-hidden="true" />{copied ? t.fleet.copied : t.fleet.copyLink}</Button>
    </div>}
    {!driver.truckId && !driver.disabled && <p className="text-sm text-muted">{t.fleet.needsTruck}</p>}
    {error && <FormMessage>{error}</FormMessage>}
    <div className="flex flex-wrap gap-2">
      {!driver.disabled && driver.truckId && <Button size="sm" onClick={send} disabled={busy}><Send aria-hidden="true" />{t.fleet.sendLink}</Button>}
      {linkActive && <Button size="sm" variant="secondary" disabled={busy}
        onClick={() => run(async () => { await revokeLink({ token, driverId: driver._id }); setShared(null); })}>{t.fleet.revokeLink}</Button>}
      <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>{t.common.edit}</Button>
      <Button size="sm" variant="ghost" disabled={busy}
        onClick={() => run(() => setDisabled({ token, driverId: driver._id, disabled: !driver.disabled }))}>{driver.disabled ? t.fleet.enable : t.fleet.disable}</Button>
    </div>
  </Card>;
}
