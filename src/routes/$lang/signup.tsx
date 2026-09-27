import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Sprout, Truck } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { GuestOnly } from "~/components/session-gate";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Chips, Field, FormMessage, Input, Select } from "~/components/ui/form";
import { dictFor } from "~/i18n";
import { cn } from "~/lib/cn";
import { useLang, useT } from "~/lib/i18n";
import { seo } from "~/lib/seo";
import { useSession } from "~/lib/session";
import { VEHICLE_CATEGORIES, type Lang, type VehicleCategory } from "~/shared/domain";
import { zones, type Zone } from "~/shared/zones";

type SignupRole = "producer" | "transporter";

export const Route = createFileRoute("/$lang/signup")({
  validateSearch: (search: Record<string, unknown>): { role?: SignupRole } => ({
    role: search.role === "producer" || search.role === "transporter" ? search.role : undefined,
  }),
  head: ({ params }) => {
    const lang = params.lang as Lang;
    const t = dictFor(lang);
    return seo({ lang, path: "/signup", title: t.meta.signup.title, description: t.meta.signup.description });
  },
  component: () => <GuestOnly><SignupPage /></GuestOnly>,
});

function SignupPage() {
  const lang = useLang();
  const t = useT();
  const { signIn } = useSession();
  const signup = useMutation(api.auth.signup);
  const [role, setRole] = useState<SignupRole>(Route.useSearch().role ?? "producer");
  const [form, setForm] = useState({ displayName: "", companyName: "", phone: "", pin: "", pinConfirm: "", mainZone: "", mainLocation: "" });
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [workZones, setWorkZones] = useState<Zone[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value });
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.pin !== form.pinConfirm) { setError(t.auth.pinMismatch); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await signup({
        role, lang, phone: form.phone, pin: form.pin,
        displayName: form.displayName || undefined, companyName: form.companyName || undefined,
        ...(role === "producer"
          ? { mainZone: (form.mainZone || undefined) as Zone | undefined, mainLocation: form.mainLocation || undefined }
          : { vehicleCategories, workZones }),
      });
      if (result.ok) signIn(result.token);
      else setError(t.errors[result.error] ?? t.common.genericError);
    } catch {
      setError(t.common.offlineAction);
    } finally {
      setBusy(false);
    }
  };

  const roleOption = (value: SignupRole, Icon: typeof Sprout, title: string, hint: string) => (
    <button type="button" onClick={() => setRole(value)} aria-pressed={role === value}
      className={cn("flex items-start gap-3 rounded-2xl border p-4 text-left", role === value ? "border-brand-800 bg-brand-50 ring-2 ring-brand-800" : "border-line bg-white hover:border-brand-200")}>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", role === value ? "bg-brand-800 text-white" : "bg-brand-50 text-brand-800")}><Icon className="size-5" aria-hidden="true" /></span>
      <span><span className="block font-semibold">{title}</span><span className="block text-sm text-muted">{hint}</span></span>
    </button>
  );

  return <div className="container-page flex justify-center py-12 sm:py-16">
    <Card className="w-full max-w-xl p-6 sm:p-8">
      <h1 className="text-2xl font-bold">{t.auth.signupTitle}</h1>
      <p className="mt-1 text-muted">{t.auth.signupIntro}</p>
      <form onSubmit={submit} className="mt-6 grid gap-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t.auth.iAm}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {roleOption("producer", Sprout, t.auth.roleProducer, t.auth.roleProducerHint)}
            {roleOption("transporter", Truck, t.auth.roleTransporter, t.auth.roleTransporterHint)}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="signup-name" label={`${t.auth.name} (${t.common.optional})`}><Input id="signup-name" autoComplete="name" value={form.displayName} onChange={set("displayName")} /></Field>
          <Field id="signup-company" label={`${t.auth.company} (${t.common.optional})`}><Input id="signup-company" autoComplete="organization" value={form.companyName} onChange={set("companyName")} /></Field>
        </div>
        <Field id="signup-phone" label={t.auth.phone}><Input id="signup-phone" type="tel" inputMode="tel" autoComplete="username" placeholder={t.auth.phonePlaceholder} value={form.phone} onChange={set("phone")} required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="signup-pin" label={t.auth.pin}><Input id="signup-pin" type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} autoComplete="new-password" value={form.pin} onChange={set("pin")} required /></Field>
          <Field id="signup-pin-confirm" label={t.auth.pinConfirm}><Input id="signup-pin-confirm" type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} autoComplete="new-password" value={form.pinConfirm} onChange={set("pinConfirm")} required /></Field>
        </div>

        {role === "producer"
          ? <div className="grid gap-4 sm:grid-cols-2">
              <Field id="signup-zone" label={t.auth.region}>
                <Select id="signup-zone" value={form.mainZone} onChange={set("mainZone")}>
                  <option value="">{t.producer.regionPlaceholder}</option>
                  {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
                </Select>
              </Field>
              <Field id="signup-village" label={t.auth.village}><Input id="signup-village" value={form.mainLocation} onChange={set("mainLocation")} /></Field>
            </div>
          : <>
              <Chips label={t.auth.vehicles} options={VEHICLE_CATEGORIES.map((id) => ({ id, label: t.categories[id].label }))} selected={vehicleCategories} onToggle={(value) => setVehicleCategories(toggle(vehicleCategories, value))} />
              <Chips label={t.auth.workZones} options={zones} selected={workZones} onToggle={(value) => setWorkZones(toggle(workZones, value))} />
            </>}

        {error && <FormMessage>{error}</FormMessage>}
        <Button type="submit" size="lg" disabled={busy}>{busy ? t.auth.signingUp : t.auth.submitSignup}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">{t.auth.haveAccount} <Link to="/$lang/login" params={{ lang }} className="font-semibold text-brand-700 hover:underline">{t.nav.login}</Link></p>
    </Card>
  </div>;
}
