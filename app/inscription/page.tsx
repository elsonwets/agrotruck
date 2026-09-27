"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { zones } from "@/data/zones";
import { useSession } from "@/lib/use-session";
import { GuestOnly } from "@/components/auth/session-gate";

function SignupForm() {
  const { refresh } = useSession();
  const [form, setForm] = useState({ displayName: "", phone: "", pin: "", pinConfirm: "", mainZone: "", mainLocation: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.pin !== form.pinConfirm) { setError("Les deux PIN ne sont pas identiques."); return; }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/.netlify/functions/auth?action=signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: form.displayName, phone: form.phone, pin: form.pin, mainZone: form.mainZone || undefined, mainLocation: form.mainLocation }),
      });
      if (!response.ok) {
        const { error: message } = (await response.json().catch(() => ({}))) as { error?: string };
        setError(response.status === 400 ? "Vérifiez le numéro et le PIN (4 à 6 chiffres)." : message ?? "Inscription impossible pour le moment.");
        return;
      }
      await refresh(); // GuestOnly redirige alors vers l'espace producteur
    } catch {
      setError("Inscription impossible pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell flex min-h-[70vh] items-center justify-center py-16">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[20px] border border-primary/10 bg-white p-7 shadow-[0_18px_50px_rgba(17,17,17,.06)]">
        <h1 className="font-heading text-2xl font-bold text-foreground">Créer un compte</h1>
        <p className="mt-1 text-sm text-muted-foreground">Producteurs et coopératives : demandez un transport en quelques secondes.</p>
        <div className="mt-6 grid gap-4">
          <div>
            <Label htmlFor="signup-name">Nom ou coopérative (facultatif)</Label>
            <Input id="signup-name" value={form.displayName} onChange={set("displayName")} autoComplete="name" />
          </div>
          <div>
            <Label htmlFor="signup-phone">Téléphone</Label>
            <Input id="signup-phone" type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} required autoComplete="username" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="signup-pin">PIN (4 à 6 chiffres)</Label>
              <Input id="signup-pin" type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} value={form.pin} onChange={set("pin")} required autoComplete="new-password" />
            </div>
            <div>
              <Label htmlFor="signup-pin-confirm">Confirmer</Label>
              <Input id="signup-pin-confirm" type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} value={form.pinConfirm} onChange={set("pinConfirm")} required autoComplete="new-password" />
            </div>
          </div>
          <div>
            <Label htmlFor="signup-zone">Région</Label>
            <Select id="signup-zone" value={form.mainZone} onChange={set("mainZone")}>
              <option value="">Choisir…</option>
              {zones.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="signup-location">Village ou ville</Label>
            <Input id="signup-location" value={form.mainLocation} onChange={set("mainLocation")} />
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={loading}>{loading ? "Création…" : "Créer mon compte"}</Button>
        <p className="mt-5 text-center text-sm text-muted-foreground">Déjà un compte ? <Link href="/login" className="focus-ring font-semibold text-primary hover:underline">Se connecter</Link></p>
      </form>
    </div>
  );
}

export default function Page() { return <GuestOnly><SignupForm /></GuestOnly>; }
