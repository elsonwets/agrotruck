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
import { cn, mapUrl } from "~/lib/cn";
import { useLang, useT } from "~/lib/i18n";
import { getOutbox } from "~/lib/outbox-client";
import { privateHead } from "~/lib/private-route";
import { useToken } from "~/lib/session";
import { PRODUCT_TYPES, VEHICLE_CATEGORIES, type Lang, type ProductType, type VehicleCategory } from "~/shared/domain";
import { nearestZone, zones, type Zone } from "~/shared/zones";

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
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsNote, setGpsNote] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { setTouched(true); setForm({ ...form, [key]: event.target.value }); };

  // Lieu de chargement pré-rempli avec la région et le village du profil (tant que l'utilisateur n'a rien saisi).
  const pickupZone = form.pickupZone || (!touched && me?.mainZone) || "";
  const pickupLocation = form.pickupLocation || (!touched && me?.mainLocation) || "";

  // Position du téléphone : enregistrée avec la demande (lien carte pour le transporteur) et région devinée si vide.
  // La géolocalisation n'existe que sur une page sécurisée (https ou localhost).
  const locate = () => {
    setGpsNote(null);
    if (!window.isSecureContext || !("geolocation" in navigator)) { setGpsNote({ ok: false, text: t.producer.gpsError }); return; }
    setLocating(true);
    const found = ({ coords }: GeolocationPosition) => {
      const position = { lat: Number(coords.latitude.toFixed(5)), lng: Number(coords.longitude.toFixed(5)) };
      setTouched(true);
      setGps(position);
      setForm((current) => ({
        ...current,
        pickupZone: current.pickupZone || pickupZone || nearestZone(position.lat, position.lng),
        pickupLocation: current.pickupLocation || pickupLocation || `GPS ${position.lat}, ${position.lng}`,
      }));
      setGpsNote({ ok: true, text: t.producer.gpsFound });
      setLocating(false);
    };
    const failed = (reason: GeolocationPositionError) => {
      setGpsNote({ ok: false, text: reason.code === reason.PERMISSION_DENIED ? t.producer.gpsDenied : t.producer.gpsError });
      setLocating(false);
    };
    // GPS précis d'abord ; sans signal (à l'intérieur), position approximative par le réseau.
    navigator.geolocation.getCurrentPosition(found, (reason) => {
      if (reason.code === reason.PERMISSION_DENIED) failed(reason);
      else navigator.geolocation.getCurrentPosition(found, failed, { enableHighAccuracy: false, timeout: 20_000, maximumAge: 10 * 60_000 });
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 });
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
        token, clientRequestId, vehicleCategory: category, pickupZone: pickupZone as Zone, pickupLocation, pickupGps: gps ?? undefined,
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:col-span-2">
            <Button variant="secondary" size="sm" onClick={locate} disabled={locating}><LocateFixed aria-hidden="true" />{locating ? t.producer.locating : t.producer.myLocation}</Button>
            {gps && <a href={mapUrl(gps)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-700 hover:underline">{t.producer.viewOnMap} ({gps.lat}, {gps.lng})</a>}
          </div>
          {gpsNote && <div className="sm:col-span-2"><FormMessage tone={gpsNote.ok ? "success" : "error"}>{gpsNote.text}</FormMessage></div>}
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
