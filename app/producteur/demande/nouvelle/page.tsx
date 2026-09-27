"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LocateFixed } from "lucide-react";
import { SessionGate } from "@/components/auth/session-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { vehicleCategories } from "@/data/vehicle-categories";
import { zones } from "@/data/zones";
import { productTypeLabels } from "@/types/order";
import type { PublicAccount } from "@/types/account";

const today = () => new Date().toISOString().slice(0, 10);

function NewRequestForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    vehicleCategory: "camion", pickupZone: "", pickupLocation: "", dropoffZone: "bissau", dropoffLocation: "",
    productType: "cashew", quantitySacks: "", quantityKg: "", neededFrom: today(), cargoDescription: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  // Pré-remplit le lieu de chargement avec la région et le village du profil.
  useEffect(() => {
    fetch("/.netlify/functions/auth?action=profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((account: PublicAccount | null) => {
        if (account) setForm((current) => ({ ...current, pickupZone: current.pickupZone || account.mainZone || "", pickupLocation: current.pickupLocation || account.mainLocation || "" }));
      }, () => undefined);
  }, []);

  const locate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = `GPS ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        setForm((current) => ({ ...current, pickupLocation: current.pickupLocation ? `${current.pickupLocation} (${position})` : position }));
        setLocating(false);
      },
      () => { setError("Position GPS indisponible. Écrivez le lieu de chargement."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.quantitySacks && !form.quantityKg) { setError("Indiquez le nombre de sacs ou le poids."); return; }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/.netlify/functions/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          quantitySacks: form.quantitySacks ? Number(form.quantitySacks) : undefined,
          quantityKg: form.quantityKg ? Number(form.quantityKg) : undefined,
        }),
      });
      if (!response.ok) { setError("Vérifiez les champs de la demande."); return; }
      const { id } = (await response.json()) as { id: string };
      router.push(`/producteur/demande?id=${id}`);
    } catch {
      setError("Envoi impossible pour le moment. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell max-w-2xl py-10">
      <h1 className="font-heading text-3xl font-bold">Nouvelle demande de transport</h1>
      <form onSubmit={submit} className="mt-8 grid gap-5 rounded-2xl border border-primary/10 bg-white p-5 sm:p-6">
        <Field id="request-vehicle" label="Type de véhicule">
          <Select id="request-vehicle" value={form.vehicleCategory} onChange={set("vehicleCategory")}>
            {vehicleCategories.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            <option value="any">Peu importe</option>
          </Select>
        </Field>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-bold text-primary">Chargement</legend>
          <Select aria-label="Région de chargement" value={form.pickupZone} onChange={set("pickupZone")} required>
            <option value="">Région…</option>
            {zones.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </Select>
          <Input aria-label="Lieu de chargement" placeholder="Village, magasin…" value={form.pickupLocation} onChange={set("pickupLocation")} required />
          {typeof navigator !== "undefined" && "geolocation" in navigator && (
            <Button type="button" variant="secondary" size="sm" onClick={locate} disabled={locating} className="sm:col-span-2 sm:justify-self-start"><LocateFixed className="size-4" />{locating ? "Localisation…" : "Ma localisation"}</Button>
          )}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-bold text-primary">Déchargement</legend>
          <Select aria-label="Région de déchargement" value={form.dropoffZone} onChange={set("dropoffZone")} required>
            {zones.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
          </Select>
          <Input aria-label="Lieu de déchargement" placeholder="Port, entrepôt…" value={form.dropoffLocation} onChange={set("dropoffLocation")} required />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="request-product" label="Produit">
            <Select id="request-product" value={form.productType} onChange={set("productType")}>
              {Object.entries(productTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field id="request-sacks" label="Nombre de sacs"><Input id="request-sacks" type="number" inputMode="numeric" min="0" value={form.quantitySacks} onChange={set("quantitySacks")} /></Field>
          <Field id="request-kg" label="Poids estimé (kg)"><Input id="request-kg" type="number" inputMode="numeric" min="0" value={form.quantityKg} onChange={set("quantityKg")} /></Field>
        </div>

        <Field id="request-date" label="Date souhaitée"><Input id="request-date" type="date" min={today()} value={form.neededFrom} onChange={set("neededFrom")} required /></Field>
        <Field id="request-comment" label="Commentaire (facultatif)"><Textarea id="request-comment" rows={2} value={form.cargoDescription} onChange={set("cargoDescription")} /></Field>

        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" size="lg" disabled={saving}>{saving ? "Publication…" : "Publier la demande"}</Button>
      </form>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div><Label htmlFor={id}>{label}</Label>{children}</div>;
}

export default function Page() { return <SessionGate role="producer"><NewRequestForm /></SessionGate>; }
