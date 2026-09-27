"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/use-session";
import { GuestOnly } from "@/components/auth/session-gate";

function LoginForm() {
  const { refresh } = useSession();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/.netlify/functions/auth?action=login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      if (!response.ok) {
        const { error: message } = (await response.json().catch(() => ({}))) as { error?: string };
        setError(response.status === 401 ? "Numéro ou PIN incorrect." : message ?? "Service de connexion indisponible.");
        return;
      }
      await refresh(); // GuestOnly redirige alors vers l'espace du compte
    } catch {
      setError("Service de connexion indisponible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell flex min-h-[70vh] items-center justify-center py-16">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[20px] border border-primary/10 bg-white p-7 shadow-[0_18px_50px_rgba(17,17,17,.06)]">
        <h1 className="font-heading text-2xl font-bold text-foreground">Connexion</h1>
        <p className="mt-1 text-sm text-muted-foreground">Producteurs, transporteurs et Badora.</p>
        <div className="mt-6 grid gap-4">
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required autoComplete="username" />
          </div>
          <div>
            <Label htmlFor="password">PIN ou mot de passe</Label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</Button>
        <p className="mt-5 text-center text-sm text-muted-foreground">Producteur ou coopérative ? <Link href="/inscription" className="focus-ring font-semibold text-primary hover:underline">Créer un compte</Link></p>
      </form>
    </div>
  );
}

export default function Page() { return <GuestOnly><LoginForm /></GuestOnly>; }
