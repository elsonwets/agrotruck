"use client";

import { useEffect, useState } from "react";
import { SessionGate } from "@/components/auth/session-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { vehicleCategories, type VehicleCategory } from "@/data/vehicle-categories";
import { zones, type Zone } from "@/data/zones";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";
import type { PublicAccount } from "@/types/account";

type Form = {
  displayName: string; phone: string; companyName: string; vehicleCapacityTons: string;
  vehicleCategories: VehicleCategory[]; workZones: Zone[]; mainZone: string; mainLocation: string;
};

function toForm(account: PublicAccount): Form {
  return {
    displayName: account.displayName, phone: account.phone, companyName: account.companyName ?? "",
    vehicleCapacityTons: account.vehicleCapacityTons !== undefined ? String(account.vehicleCapacityTons) : "",
    vehicleCategories: account.vehicleCategories ?? [], workZones: account.workZones ?? [],
    mainZone: account.mainZone ?? "", mainLocation: account.mainLocation ?? "",
  };
}

function ProfileForm() {
  const { refresh } = useSession();
  const [account, setAccount] = useState<PublicAccount | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/.netlify/functions/auth?action=profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: PublicAccount | null) => { if (data) { setAccount(data); setForm(toForm(data)); } });
  }, []);

  if (!account || !form) return <p className="page-shell py-10 text-sm text-muted-foreground">Chargement…</p>;

  const set = (key: "displayName" | "phone" | "companyName" | "vehicleCapacityTons" | "mainZone" | "mainLocation") =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value });
  const toggle = <T extends string>(key: "vehicleCategories" | "workZones", value: T) => {
    const values = form[key] as T[];
    setForm({ ...form, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = {
      displayName: form.displayName, phone: form.phone, companyName: form.companyName,
      ...(account.role === "partner" && {
        vehicleCategories: form.vehicleCategories, workZones: form.workZones,
        ...(form.vehicleCapacityTons !== "" && { vehicleCapacityTons: Number(form.vehicleCapacityTons) }),
      }),
      ...(account.role === "producer" && { mainZone: form.mainZone || undefined, mainLocation: form.mainLocation }),
    };
    try {
      const response = await fetch("/.netlify/functions/auth?action=update-profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as PublicAccount & { error?: string };
      if (!response.ok) { setMessage({ ok: false, text: data.error === "Ce numéro a déjà un compte" ? data.error : "Vérifiez les champs." }); return; }
      setAccount(data);
      setForm(toForm(data));
      setMessage({ ok: true, text: "Profil enregistré." });
      void refresh(); // nom affiché dans la barre du haut
    } catch {
      setMessage({ ok: false, text: "Enregistrement impossible pour le moment." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell max-w-2xl py-10">
      <h1 className="font-heading text-3xl font-bold">Mon profil</h1>
      <form onSubmit={submit} className="mt-8 grid gap-5 rounded-2xl border border-primary/10 bg-white p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="profile-name" label="Nom"><Input id="profile-name" value={form.displayName} onChange={set("displayName")} required /></Field>
          <Field id="profile-phone" label="Téléphone"><Input id="profile-phone" type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} required /></Field>
        </div>
        <Field id="profile-company" label="Entreprise ou coopérative (facultatif)"><Input id="profile-company" value={form.companyName} onChange={set("companyName")} /></Field>

        {account.role === "partner" && <>
          <Choices label="Mes véhicules" options={vehicleCategories} selected={form.vehicleCategories} onToggle={(value) => toggle("vehicleCategories", value)} />
          <Field id="profile-capacity" label="Capacité (tonnes)"><Input id="profile-capacity" type="number" min="0" step="0.5" value={form.vehicleCapacityTons} onChange={set("vehicleCapacityTons")} /></Field>
          <Choices label="Régions où je charge" options={zones} selected={form.workZones} onToggle={(value) => toggle("workZones", value)} />
          <p className="-mt-2 text-xs text-muted-foreground">Vous ne voyez que les missions de ces régions, pour vos types de véhicules.</p>
        </>}

        {account.role === "producer" && <div className="grid gap-4 sm:grid-cols-2">
          <Field id="profile-zone" label="Région">
            <Select id="profile-zone" value={form.mainZone} onChange={set("mainZone")}>
              <option value="">Choisir…</option>
              {zones.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </Select>
          </Field>
          <Field id="profile-location" label="Village ou ville"><Input id="profile-location" value={form.mainLocation} onChange={set("mainLocation")} /></Field>
        </div>}

        {message && <p className={cn("text-sm", message.ok ? "text-primary" : "text-danger")}>{message.text}</p>}
        <Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </form>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function Choices<T extends string>({ label, options, selected, onToggle }: { label: string; options: readonly { id: T; label: string }[]; selected: T[]; onToggle: (value: T) => void }) {
  return <fieldset>
    <legend className="mb-2 block text-sm font-bold text-primary">{label}</legend>
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.id);
        return <button key={option.id} type="button" aria-pressed={active} onClick={() => onToggle(option.id)} className={cn("focus-ring min-h-10 rounded-full border px-4 text-sm font-semibold transition", active ? "border-primary bg-primary text-white" : "border-primary/15 bg-white text-primary hover:border-primary/30")}>{option.label}</button>;
      })}
    </div>
  </fieldset>;
}

export default function Page() { return <SessionGate role={["admin", "partner", "producer"]}><ProfileForm /></SessionGate>; }
