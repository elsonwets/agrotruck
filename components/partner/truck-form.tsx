"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Truck, TruckType } from "@/types/truck";
import { truckTypeLabels } from "@/types/truck";

type FormState = {
  name: string; brand: string; model: string; type: TruckType; capacityTons: string;
  location: string; serviceAreas: string; acceptedMaterials: string; ownerName: string;
  phone: string; whatsapp: string; description: string; images: string; restrictions: string;
};

function toFormState(truck?: Truck): FormState {
  return {
    name: truck?.name ?? "", brand: truck?.brand ?? "", model: truck?.model ?? "",
    type: truck?.type ?? "flatbed", capacityTons: truck ? String(truck.capacityTons) : "",
    location: truck?.location ?? "", serviceAreas: truck?.serviceAreas.join(", ") ?? "",
    acceptedMaterials: truck?.acceptedMaterials.join(", ") ?? "", ownerName: truck?.ownerName ?? "",
    phone: truck?.phone ?? "", whatsapp: truck?.whatsapp ?? "", description: truck?.description ?? "",
    images: truck?.images.join(", ") ?? "", restrictions: truck?.restrictions.join(", ") ?? "",
  };
}

export function TruckForm({ truck, onSaved }: { truck?: Truck; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(() => toFormState(truck));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name, brand: form.brand, model: form.model, type: form.type,
      capacityTons: Number(form.capacityTons), location: form.location,
      serviceAreas: split(form.serviceAreas), acceptedMaterials: split(form.acceptedMaterials),
      ownerName: form.ownerName, ownerType: "individual", phone: form.phone, whatsapp: form.whatsapp,
      description: form.description, images: split(form.images), restrictions: split(form.restrictions),
      availability: truck?.availability ?? "available",
    };
    try {
      const response = await fetch(truck ? `/.netlify/functions/trucks?id=${truck.id}` : "/.netlify/functions/trucks", {
        method: truck ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) { setError("Impossible d'enregistrer ce camion. Vérifiez les champs."); return; }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="Nom de l'annonce"><Input value={form.name} onChange={set("name")} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marque"><Input value={form.brand} onChange={set("brand")} /></Field>
        <Field label="Modèle"><Input value={form.model} onChange={set("model")} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type de véhicule">
          <select className="focus-ring h-11 w-full rounded-xl border border-primary/15 bg-white px-3 text-sm" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as TruckType }))}>
            {Object.entries(truckTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Capacité (tonnes)"><Input type="number" min="0" value={form.capacityTons} onChange={set("capacityTons")} required /></Field>
      </div>
      <Field label="Localisation"><Input value={form.location} onChange={set("location")} required /></Field>
      <Field label="Zones desservies (séparées par des virgules)"><Input value={form.serviceAreas} onChange={set("serviceAreas")} /></Field>
      <Field label="Marchandises acceptées (séparées par des virgules)"><Input value={form.acceptedMaterials} onChange={set("acceptedMaterials")} /></Field>
      <Field label="Nom du contact"><Input value={form.ownerName} onChange={set("ownerName")} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone"><Input value={form.phone} onChange={set("phone")} required /></Field>
        <Field label="WhatsApp"><Input value={form.whatsapp} onChange={set("whatsapp")} required /></Field>
      </div>
      <Field label="Description"><Textarea value={form.description} onChange={set("description")} rows={4} /></Field>
      <Field label="Photos — liens vers des images déjà en ligne (séparés par des virgules)"><Textarea value={form.images} onChange={set("images")} rows={2} required /></Field>
      <Field label="Restrictions / conditions (séparées par des virgules)"><Input value={form.restrictions} onChange={set("restrictions")} /></Field>
      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted-foreground">{truck ? "Modifier ces informations renvoie l'annonce en validation chez Badora." : "Cette annonce sera visible après validation par Badora."}</p>
      <Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : truck ? "Enregistrer les modifications" : "Soumettre à validation"}</Button>
    </form>
  );
}

function split(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label>{label}</Label><div className="mt-1.5">{children}</div></div>; }
