"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { truckTypeLabels, type TruckType } from "@/types/truck";
import { whatsappUrl } from "@/lib/utils";
import { agroTruckWhatsapp } from "@/lib/contact";

const emptyForm = {
  requestedTruckCount: "1", truckType: "flatbed" as TruckType, pickupLocation: "", dropoffLocation: "",
  neededFrom: "", cargoDescription: "", clientName: "", clientPhone: "",
};
type FormState = typeof emptyForm;

function isTruckType(value: string | null): value is TruckType {
  return value !== null && value in truckTypeLabels;
}

export function OrderRequestForm() {
  const typeParam = useSearchParams().get("type");
  const [form, setForm] = useState<FormState>({ ...emptyForm, truckType: isTruckType(typeParam) ? typeParam : emptyForm.truckType });
  const [saving, setSaving] = useState(false);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload = { ...form, requestedTruckCount: Number(form.requestedTruckCount) };
    // L'historique côté Badora est best-effort : la demande part sur WhatsApp même si l'enregistrement échoue.
    await fetch("/.netlify/functions/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, website: "" }),
    }).catch(() => null);
    const message = [
      "Olá Badora, je souhaite louer :",
      `${payload.requestedTruckCount} camion(s) — ${truckTypeLabels[form.truckType]}`,
      `Trajet : ${payload.pickupLocation} → ${payload.dropoffLocation}`,
      `À partir du : ${payload.neededFrom}`,
      payload.cargoDescription ? `Marchandise : ${payload.cargoDescription}` : null,
      `Contact : ${payload.clientName}, ${payload.clientPhone}`,
    ].filter(Boolean).join("\n");
    const url = whatsappUrl(agroTruckWhatsapp, message);
    window.open(url, "_blank", "noreferrer");
    setSentUrl(url);
    setSaving(false);
  };

  if (sentUrl) {
    return <div className="rounded-[20px] border border-primary/10 bg-white p-6 text-center">
      <p className="font-heading text-lg font-semibold text-foreground">Demande prête</p>
      <p className="mt-2 text-sm text-muted-foreground">Votre demande est pré-remplie dans WhatsApp — il ne reste qu&apos;à l&apos;envoyer à Badora.</p>
      <Button asChild className="mt-5"><a href={sentUrl} target="_blank" rel="noreferrer"><MessageCircle className="size-4" />Ouvrir WhatsApp</a></Button>
    </div>;
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-[20px] border border-primary/10 bg-white p-6 shadow-[0_18px_50px_rgba(17,17,17,.06)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="order-count" label="Nombre de camions"><Input id="order-count" type="number" min="1" value={form.requestedTruckCount} onChange={set("requestedTruckCount")} required /></Field>
        <Field id="order-type" label="Type de camion">
          <Select id="order-type" value={form.truckType} onChange={set("truckType")}>
            {Object.entries(truckTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="order-pickup" label="Départ"><Input id="order-pickup" value={form.pickupLocation} onChange={set("pickupLocation")} required /></Field>
        <Field id="order-dropoff" label="Destination"><Input id="order-dropoff" value={form.dropoffLocation} onChange={set("dropoffLocation")} required /></Field>
      </div>
      <Field id="order-date" label="Date souhaitée"><Input id="order-date" type="date" value={form.neededFrom} onChange={set("neededFrom")} required /></Field>
      <Field id="order-cargo" label="Marchandise transportée"><Textarea id="order-cargo" value={form.cargoDescription} onChange={set("cargoDescription")} rows={2} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="order-name" label="Votre nom"><Input id="order-name" value={form.clientName} onChange={set("clientName")} required autoComplete="name" /></Field>
        <Field id="order-phone" label="Votre téléphone"><Input id="order-phone" type="tel" value={form.clientPhone} onChange={set("clientPhone")} required autoComplete="tel" /></Field>
      </div>
      <Button type="submit" disabled={saving}><MessageCircle className="size-4" />{saving ? "Envoi…" : "Demander sur WhatsApp"}</Button>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div><Label htmlFor={id}>{label}</Label><div className="mt-1.5">{children}</div></div>;
}
