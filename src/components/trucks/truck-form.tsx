import { useState } from "react";
import { useMutation } from "convex/react";
import { Camera, X } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Chips, Field, FormMessage, Input, Select, Textarea } from "~/components/ui/form";
import { CategoryPicker } from "./category-picker";
import { errorMessage } from "~/lib/errors";
import { useT } from "~/lib/i18n";
import { useToken } from "~/lib/session";
import { AVAILABILITIES, LISTING_MODES, type Availability, type ListingMode, type VehicleCategory } from "~/shared/domain";
import { zones, type Zone } from "~/shared/zones";

export type OwnedTruck = FunctionReturnType<typeof api.trucks.mine>[number];
type Photo = { id: Id<"_storage">; url: string };

const MAX_PHOTOS = 6;

export function TruckForm({ truck, onSaved }: { truck?: OwnedTruck; onSaved: () => void }) {
  const t = useT();
  const token = useToken();
  const create = useMutation(api.trucks.create);
  const update = useMutation(api.trucks.update);
  const uploadUrl = useMutation(api.trucks.generateUploadUrl);
  const [form, setForm] = useState({
    name: truck?.name ?? "", brand: truck?.brand ?? "", model: truck?.model ?? "", plate: truck?.plate ?? "",
    listingMode: truck?.listingMode ?? "transport", availability: truck?.availability ?? "available",
    capacityTons: truck ? String(truck.capacityTons) : "", zone: truck?.zone ?? "", location: truck?.location ?? "",
    goods: truck?.goods.join(", ") ?? "", description: truck?.description ?? "", whatsapp: truck?.whatsapp ?? "",
  });
  const [category, setCategory] = useState<VehicleCategory | undefined>(truck?.category);
  const [serviceZones, setServiceZones] = useState<Zone[]>(truck?.serviceZones ?? []);
  const [photos, setPhotos] = useState<Photo[]>(truck ? truck.photoIds.map((id, index) => ({ id, url: truck.photoUrls[index] ?? "" })) : []);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: event.target.value });

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of [...files].slice(0, MAX_PHOTOS - photos.length)) {
        const response = await fetch(await uploadUrl({ token }), { method: "POST", headers: { "Content-Type": file.type }, body: file });
        const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
        setPhotos((current) => [...current, { id: storageId, url: URL.createObjectURL(file) }]);
      }
    } catch (reason) {
      setError(errorMessage(reason, t));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!category) { setError(t.transporter.category); return; }
    setBusy(true);
    setError(null);
    const fields = {
      token, name: form.name, category, listingMode: form.listingMode as ListingMode, availability: form.availability as Availability,
      brand: form.brand || undefined, model: form.model || undefined, plate: form.plate || undefined, capacityTons: Number(form.capacityTons || 0),
      zone: form.zone as Zone, location: form.location, serviceZones,
      goods: form.goods.split(",").map((good) => good.trim()).filter(Boolean),
      description: form.description, whatsapp: form.whatsapp || undefined, photoIds: photos.map((photo) => photo.id),
    };
    try {
      if (truck) await update({ ...fields, truckId: truck._id });
      else await create(fields);
      onSaved();
    } catch (reason) {
      setError(errorMessage(reason, t));
    } finally {
      setBusy(false);
    }
  };

  return <form onSubmit={submit} className="grid gap-6">
    <Card className="p-5 sm:p-6"><CategoryPicker value={category} onChange={setCategory} /></Card>

    <Card className="grid gap-5 p-5 sm:p-6">
      <Field id="truck-name" label={t.transporter.truckName}><Input id="truck-name" placeholder={t.transporter.truckNamePlaceholder} value={form.name} onChange={set("name")} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="truck-brand" label={`${t.transporter.brand} (${t.common.optional})`}><Input id="truck-brand" value={form.brand} onChange={set("brand")} /></Field>
        <Field id="truck-model" label={`${t.transporter.model} (${t.common.optional})`}><Input id="truck-model" value={form.model} onChange={set("model")} /></Field>
        <Field id="truck-plate" label={`${t.transporter.plate} (${t.common.optional})`}><Input id="truck-plate" value={form.plate} onChange={set("plate")} autoCapitalize="characters" /></Field>
        <Field id="truck-capacity" label={t.transporter.capacity}><Input id="truck-capacity" type="number" min="0" max="100" step="0.5" value={form.capacityTons} onChange={set("capacityTons")} required /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="truck-mode" label={t.transporter.listingMode}>
          <Select id="truck-mode" value={form.listingMode} onChange={set("listingMode")}>{LISTING_MODES.map((mode) => <option key={mode} value={mode}>{t.modes[mode]}</option>)}</Select>
        </Field>
        <Field id="truck-availability" label={t.admin.status}>
          <Select id="truck-availability" value={form.availability} onChange={set("availability")}>{AVAILABILITIES.map((value) => <option key={value} value={value}>{t.availability[value]}</option>)}</Select>
        </Field>
      </div>
    </Card>

    <Card className="grid gap-5 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="truck-zone" label={t.transporter.zone}>
          <Select id="truck-zone" value={form.zone} onChange={set("zone")} required>
            <option value="">{t.producer.regionPlaceholder}</option>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
          </Select>
        </Field>
        <Field id="truck-location" label={t.transporter.location}><Input id="truck-location" value={form.location} onChange={set("location")} required /></Field>
      </div>
      <Chips label={t.transporter.serviceZones} options={zones} selected={serviceZones}
        onToggle={(zone) => setServiceZones(serviceZones.includes(zone) ? serviceZones.filter((item) => item !== zone) : [...serviceZones, zone])} />
      <Field id="truck-goods" label={t.transporter.goods}><Input id="truck-goods" value={form.goods} onChange={set("goods")} /></Field>
      <Field id="truck-description" label={t.transporter.description}><Textarea id="truck-description" rows={4} value={form.description} onChange={set("description")} /></Field>
      <Field id="truck-whatsapp" label={`${t.transporter.whatsapp} (${t.common.optional})`}><Input id="truck-whatsapp" type="tel" inputMode="tel" value={form.whatsapp} onChange={set("whatsapp")} /></Field>
    </Card>

    <Card className="p-5 sm:p-6">
      <p className="text-sm font-semibold">{t.transporter.photos}</p>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative overflow-hidden rounded-xl border border-line bg-brand-50">
            {photo.url && <img src={photo.url} alt="" className="aspect-square w-full object-cover" />}
            <button type="button" onClick={() => setPhotos(photos.filter((_, other) => other !== index))} aria-label={t.transporter.removePhoto}
              className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-white text-ink shadow"><X className="size-4" aria-hidden="true" /></button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-brand-200 bg-white text-center text-xs font-semibold text-brand-700 hover:bg-brand-50">
          <span className="grid place-items-center gap-1 p-2"><Camera className="size-6" aria-hidden="true" />{uploading ? t.transporter.uploading : t.transporter.addPhotos}</span>
          <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading} onChange={(event) => void addPhotos(event.target.files)} />
        </label>}
      </div>
    </Card>

    {error && <FormMessage>{error}</FormMessage>}
    <Button type="submit" size="lg" disabled={busy || uploading}>{busy ? t.common.saving : truck ? t.common.save : t.transporter.publishTruck}</Button>
  </form>;
}
