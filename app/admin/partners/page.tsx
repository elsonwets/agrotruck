"use client";

import { useEffect, useState } from "react";
import { SessionGate } from "@/components/auth/session-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublicAccount } from "@/types/account";

function PartnersAdmin() {
  const [partners, setPartners] = useState<PublicAccount[]>([]);
  const [form, setForm] = useState({ phone: "", displayName: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  const load = () => { fetch("/.netlify/functions/auth?action=list-partners").then((response) => response.json()).then(setPartners); };
  useEffect(load, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const response = await fetch("/.netlify/functions/auth?action=create-partner", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!response.ok) { setError("Impossible de créer ce compte (numéro déjà utilisé ?)."); return; }
    setForm({ phone: "", displayName: "", password: "" });
    load();
  };

  return (
    <div className="page-shell py-12">
      <h1 className="font-heading text-3xl font-bold">Partenaires</h1>
      <form onSubmit={submit} className="mt-6 grid max-w-md gap-4 rounded-2xl border border-primary/10 bg-white p-5">
        <div><Label>Nom</Label><Input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} required /></div>
        <div><Label>Téléphone</Label><Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required /></div>
        <div><Label>Mot de passe temporaire</Label><Input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required /></div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit">Créer le compte partenaire</Button>
      </form>
      <div className="mt-8 grid gap-3">
        {partners.map((partner) => (
          <div key={partner.id} className="rounded-xl border border-primary/10 bg-white p-4"><p className="font-semibold">{partner.displayName}</p><p className="text-xs text-muted-foreground">{partner.phone}</p></div>
        ))}
      </div>
    </div>
  );
}

export default function Page() { return <SessionGate role="admin"><PartnersAdmin /></SessionGate>; }
