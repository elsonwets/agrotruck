import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SessionGate } from "~/components/session-gate";
import { Button } from "~/components/ui/button";
import { Card, PageTitle } from "~/components/ui/card";
import { Chips, Field, FormMessage, Input, PhoneInput, Select } from "~/components/ui/form";
import { dictFor } from "~/i18n";
import { errorMessage } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";
import { LANGS, VEHICLE_CATEGORIES, localPhone, type Lang, type VehicleCategory } from "~/shared/domain";
import { zones, type Zone } from "~/shared/zones";

export const Route = createFileRoute("/$lang/profile")({
  head: ({ params }) => privateHead(params.lang, dictFor(params.lang as Lang).profile.title),
  component: () => <SessionGate roles={["admin", "transporter", "producer"]}><ProfilePage /></SessionGate>,
});

function ProfilePage() {
  const t = useT();
  const token = useToken();
  const me = useQuery(api.users.me, { token });
  if (!me) return <p className="text-muted">{t.common.loading}</p>;
  return <ProfileForm key={me._id} me={me} />;
}

type Me = NonNullable<ReturnType<typeof useQuery<typeof api.users.me>>>;

function ProfileForm({ me }: { me: Me }) {
  const t = useT();
  const token = useToken();
  const update = useMutation(api.users.updateProfile);
  const [form, setForm] = useState({
    displayName: me.displayName, phone: localPhone(me.phone), companyName: me.companyName ?? "", lang: me.lang ?? "",
    capacityTons: me.capacityTons?.toString() ?? "", mainZone: me.mainZone ?? "", mainLocation: me.mainLocation ?? "",
  });
  const [categories, setCategories] = useState<VehicleCategory[]>(me.vehicleCategories);
  const [workZones, setWorkZones] = useState<Zone[]>(me.workZones);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value });
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await update({
        token, displayName: form.displayName, phone: form.phone, companyName: form.companyName,
        ...(form.lang ? { lang: form.lang as Lang } : {}),
        ...(me.role === "transporter" ? { vehicleCategories: categories, workZones, ...(form.capacityTons ? { capacityTons: Number(form.capacityTons) } : {}) } : {}),
        ...(me.role === "producer" ? { mainZone: (form.mainZone || null) as Zone | null, mainLocation: form.mainLocation } : {}),
      });
      setMessage({ ok: true, text: t.profile.saved });
    } catch (error) {
      setMessage({ ok: false, text: errorMessage(error, t) });
    } finally {
      setBusy(false);
    }
  };

  return <div className="mx-auto max-w-2xl">
    <PageTitle title={t.profile.title} intro={t.roles[me.role]} />
    <Card className="mt-6 p-5 sm:p-7">
      <form onSubmit={submit} className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="profile-name" label={t.auth.name}><Input id="profile-name" value={form.displayName} onChange={set("displayName")} required /></Field>
          <Field id="profile-phone" label={t.auth.phone}><PhoneInput id="profile-phone" value={form.phone} onChange={set("phone")} required /></Field>
        </div>
        <Field id="profile-company" label={`${t.auth.company} (${t.common.optional})`}><Input id="profile-company" value={form.companyName} onChange={set("companyName")} /></Field>

        {me.role === "transporter" && <>
          <Chips label={t.auth.vehicles} options={VEHICLE_CATEGORIES.map((id) => ({ id, label: t.categories[id].label }))} selected={categories} onToggle={(value) => setCategories(toggle(categories, value))} />
          <Field id="profile-capacity" label={t.profile.capacity}><Input id="profile-capacity" type="number" min="0" max="100" step="0.5" value={form.capacityTons} onChange={set("capacityTons")} /></Field>
          <Chips label={t.auth.workZones} options={zones} selected={workZones} onToggle={(value) => setWorkZones(toggle(workZones, value))} />
          <p className="-mt-2 text-sm text-muted">{t.profile.zonesHint}</p>
        </>}

        {me.role === "producer" && <div className="grid gap-4 sm:grid-cols-2">
          <Field id="profile-zone" label={t.auth.region}>
            <Select id="profile-zone" value={form.mainZone} onChange={set("mainZone")}>
              <option value="">{t.producer.regionPlaceholder}</option>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
            </Select>
          </Field>
          <Field id="profile-village" label={t.auth.village}><Input id="profile-village" value={form.mainLocation} onChange={set("mainLocation")} /></Field>
        </div>}

        <Field id="profile-lang" label={t.profile.language}>
          <Select id="profile-lang" value={form.lang} onChange={set("lang")}>
            <option value="">—</option>
            {LANGS.map((lang) => <option key={lang} value={lang}>{dictFor(lang).langName}</option>)}
          </Select>
        </Field>

        {message && <FormMessage tone={message.ok ? "success" : "error"}>{message.text}</FormMessage>}
        <Button type="submit" size="lg" disabled={busy}>{busy ? t.common.saving : t.common.save}</Button>
      </form>
    </Card>
  </div>;
}
