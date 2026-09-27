import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { LocateFixed } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { CategoryPicker } from "~/components/trucks/category-picker";
import { SessionGate } from "~/components/session-gate";
import { Button } from "~/components/ui/button";
import { Card, PageTitle } from "~/components/ui/card";
import { Field, FormMessage, Input, Select, Textarea } from "~/components/ui/form";
import { dictFor } from "~/i18n";
import { cn } from "~/lib/cn";
import { useLang, useT } from "~/lib/i18n";
import { getOutbox } from "~/lib/outbox-client";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";
import { PRODUCT_TYPES, VEHICLE_CATEGORIES, type Lang, type ProductType, type VehicleCategory } from "~/shared/domain";
import { zones, type Zone } from "~/shared/zones";

export const Route = createFileRoute("/$lang/producer/new")({
  validateSearch: (search: Record<string, unknown>): { category?: VehicleCategory } => ({
    category: VEHICLE_CATEGORIES.includes(search.category as VehicleCategory) ? (search.category as VehicleCategory) : undefined,
  }),
  head: ({ params }) => privateHead(params.lang, dictFor(params.lang as Lang).producer.formTitle),
  component: () => <SessionGate roles={["producer"]}><NewRequest /></SessionGate>,
});

const today = () => new Date().toISOString().slice(0, 10);

function NewRequest() {
  const lang = useLang();
  const t = useT();
  const token = useToken();
  const navigate = useNavigate();
  const me = useQuery(api.users.me, { token });
  const [category, setCategory] = useState<VehicleCategory | "any">(Route.useSearch().category ?? "camion");
  const [form, setForm] = useState({ pickupZone: "", pickupLocation: "", dropoffZone: "bissau", dropoffLocation: "", productType: "cashew", quantitySacks: "", quantityKg: "", neededFrom: today(), comment: "" });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setTouched(true); setForm({ ...form, [key]: event.target.value }); };

  // Lieu de chargement pré-rempli avec la région et le village du profil (tant que l'utilisateur n'a rien saisi).
  const pickupZone = form.pickupZone || (!touched && me?.mainZone) || "";
  const pickupLocation = form.pickupLocation || (!touched && me?.mainLocation) || "";

  const locate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const gps = `GPS ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        setTouched(true);
        setForm((current) => ({ ...current, pickupZone: current.pickupZone || pickupZone, pickupLocation: pickupLocation ? `${pickupLocation} (${gps})` : gps }));
        setLocating(false);
      },
      () => { setError(t.producer.gpsError); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.quantitySacks && !form.quantityKg) { setError(t.errors.quantity_required ?? null); return; }
    const outbox = getOutbox();
    if (!outbox) return;
    setBusy(true);
    setError(null);
    // Identifiant choisi ici : une demande publiée hors ligne puis rejouée ne crée pas de doublon.
    const clientRequestId = crypto.randomUUID();
    const result = await outbox.submit({
      kind: "create",
      label: `${pickupLocation} → ${form.dropoffLocation}`,
      args: {
        token, clientRequestId, vehicleCategory: category, pickupZone: pickupZone as Zone, pickupLocation,
        dropoffZone: form.dropoffZone as Zone, dropoffLocation: form.dropoffLocation, productType: form.productType as ProductType,
        quantitySacks: form.quantitySacks ? Number(form.quantitySacks) : undefined, quantityKg: form.quantityKg ? Number(form.quantityKg) : undefined,
        neededFrom: form.neededFrom, comment: form.comment,
      },
    });
    setBusy(false);
    if (result.status === "rejected") { setError(t.errors[result.code] ?? t.common.genericError); return; }
    if (result.status === "queued") { void navigate({ to: "/$lang/producer", params: { lang } }); return; }
    void navigate({ to: "/$lang/producer/missions/$missionId", params: { lang, missionId: result.result as Id<"missions"> } });
  };

  return <div className="mx-auto max-w-3xl">
    <PageTitle title={t.producer.formTitle} />
    <form onSubmit={submit} className="mt-6 grid gap-6">
      <Card className="p-5 sm:p-6">
        <CategoryPicker value={category === "any" ? undefined : category} onChange={(value) => setCategory(value ?? "any")} />
        <button type="button" onClick={() => setCategory("any")} aria-pressed={category === "any"}
          className={cn("mt-3 min-h-10 rounded-full border px-4 text-sm font-medium", category === "any" ? "border-brand-800 bg-brand-800 text-white" : "border-line bg-white")}>
          {t.categories.any}
        </button>
      </Card>

      <Card className="grid gap-5 p-5 sm:p-6">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">{t.producer.pickup}</legend>
          <Select aria-label={`${t.producer.pickup} — ${t.auth.region}`} value={pickupZone} onChange={set("pickupZone")} required>
            <option value="">{t.producer.regionPlaceholder}</option>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
          </Select>
          <Input aria-label={t.producer.pickup} placeholder={t.producer.pickupPlaceholder} value={pickupLocation} onChange={set("pickupLocation")} required />
          {typeof navigator !== "undefined" && "geolocation" in navigator && (
            <Button variant="secondary" size="sm" onClick={locate} disabled={locating} className="sm:col-span-2 sm:justify-self-start"><LocateFixed aria-hidden="true" />{locating ? t.producer.locating : t.producer.myLocation}</Button>
          )}
        </fieldset>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">{t.producer.dropoff}</legend>
          <Select aria-label={`${t.producer.dropoff} — ${t.auth.region}`} value={form.dropoffZone} onChange={set("dropoffZone")} required>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
          </Select>
          <Input aria-label={t.producer.dropoff} placeholder={t.producer.dropoffPlaceholder} value={form.dropoffLocation} onChange={set("dropoffLocation")} required />
        </fieldset>
      </Card>

      <Card className="grid gap-5 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="request-product" label={t.producer.product}>
            <Select id="request-product" value={form.productType} onChange={set("productType")}>
              {PRODUCT_TYPES.map((product) => <option key={product} value={product}>{t.products[product]}</option>)}
            </Select>
          </Field>
          <Field id="request-sacks" label={t.producer.sacks}><Input id="request-sacks" type="number" inputMode="numeric" min="0" value={form.quantitySacks} onChange={set("quantitySacks")} /></Field>
          <Field id="request-kg" label={t.producer.weight}><Input id="request-kg" type="number" inputMode="numeric" min="0" value={form.quantityKg} onChange={set("quantityKg")} /></Field>
        </div>
        <Field id="request-date" label={t.producer.date}><Input id="request-date" type="date" min={today()} value={form.neededFrom} onChange={set("neededFrom")} required /></Field>
        <Field id="request-comment" label={`${t.producer.comment} (${t.common.optional})`}><Textarea id="request-comment" rows={3} value={form.comment} onChange={set("comment")} /></Field>
      </Card>

      {error && <FormMessage>{error}</FormMessage>}
      <Button type="submit" size="lg" disabled={busy}>{busy ? t.producer.publishing : t.producer.publish}</Button>
    </form>
  </div>;
}
