"use client";

import { useCallback, useEffect, useState } from "react";
import { SessionGate } from "@/components/auth/session-gate";
import { FilterTabs } from "@/components/missions/mission-parts";
import { roleLabels } from "@/components/layout/account-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vehicleCategoryLabels } from "@/data/vehicle-categories";
import { zoneLabels } from "@/data/zones";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";
import type { AccountRole, PublicAccount } from "@/types/account";

type Filter = "all" | AccountRole;

function UsersAdmin() {
  const { session } = useSession();
  const [users, setUsers] = useState<PublicAccount[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    fetch("/.netlify/functions/auth?action=list-users").then((response) => (response.ok ? response.json() : [])).then(setUsers, () => setUsers([]));
  }, []);
  useEffect(load, [load]);

  const post = async (action: string, body: object, success: string) => {
    setMessage(null);
    const response = await fetch(`/.netlify/functions/auth?action=${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setMessage(response.ok ? { ok: true, text: success } : { ok: false, text: data.error ?? "Action impossible." });
    if (response.ok) load();
    return response.ok;
  };

  const visible = users?.filter((user) => filter === "all" || user.role === filter)
    .sort((a, b) => a.role.localeCompare(b.role) || a.displayName.localeCompare(b.displayName));

  return (
    <div className="page-shell py-10">
      <h1 className="font-heading text-3xl font-bold">Utilisateurs</h1>
      <div className="mt-6"><FilterTabs value={filter} onChange={setFilter} options={[["all", "Tous"], ["partner", "Transporteurs"], ["producer", "Producteurs"], ["admin", "Badora"]]} /></div>
      {message && <p className={cn("mt-4 text-sm", message.ok ? "text-primary" : "text-danger")}>{message.text}</p>}
      <div className="mt-5 grid gap-3">
        {visible?.map((user) => <UserRow key={user.id} user={user} isMe={user.id === session?.accountId} onPost={post} />)}
        {users === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {visible?.length === 0 && <p className="text-sm text-muted-foreground">Aucun utilisateur.</p>}
      </div>
      <CreatePartnerForm onPost={post} />
    </div>
  );
}

type Post = (action: string, body: object, success: string) => Promise<boolean>;

function UserRow({ user, isMe, onPost }: { user: PublicAccount; isMe: boolean; onPost: Post }) {
  const [pin, setPin] = useState<string | null>(null);
  const details = user.role === "partner"
    ? [user.vehicleCategories?.map((category) => vehicleCategoryLabels[category]).join(", "), user.workZones?.map((zone) => zoneLabels[zone]).join(", ")]
    : user.role === "producer" ? [user.mainLocation, user.mainZone && zoneLabels[user.mainZone]] : [];

  return <div className={cn("rounded-2xl border bg-white p-5", user.disabled ? "border-danger/25" : "border-primary/10")}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">{user.displayName}{user.companyName ? ` · ${user.companyName}` : ""}{isMe ? " (vous)" : ""}</p>
        <p className="text-sm text-muted-foreground">{user.phone}</p>
        {details.filter(Boolean).length > 0 && <p className="mt-1 text-xs text-muted-foreground">{details.filter(Boolean).join(" · ")}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">{roleLabels[user.role]}</span>
        {user.disabled && <span className="rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger">Bloqué</span>}
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {!isMe && <Button size="sm" variant={user.disabled ? "default" : "secondary"} onClick={() => onPost("set-disabled", { accountId: user.id, disabled: !user.disabled }, user.disabled ? "Compte réactivé." : "Compte bloqué.")}>{user.disabled ? "Réactiver" : "Bloquer"}</Button>}
      {pin === null
        ? <Button size="sm" variant="ghost" onClick={() => setPin("")}>Réinitialiser le PIN</Button>
        : <form className="flex flex-wrap items-center gap-2" onSubmit={async (event) => { event.preventDefault(); if (await onPost("reset-password", { accountId: user.id, password: pin }, `Nouveau PIN enregistré pour ${user.displayName}.`)) setPin(null); }}>
          <Input aria-label="Nouveau PIN" inputMode="numeric" placeholder="Nouveau PIN" minLength={4} value={pin} onChange={(event) => setPin(event.target.value)} className="h-9 w-36" required />
          <Button size="sm" type="submit">Enregistrer</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setPin(null)}>Annuler</Button>
        </form>}
    </div>
  </div>;
}

function CreatePartnerForm({ onPost }: { onPost: Post }) {
  const [form, setForm] = useState({ displayName: "", phone: "", password: "" });
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value }));
  return <form className="mt-10 grid max-w-xl gap-4 rounded-2xl border border-primary/10 bg-white p-5" onSubmit={async (event) => {
    event.preventDefault();
    if (await onPost("create-partner", form, `Compte transporteur créé pour ${form.displayName}.`)) setForm({ displayName: "", phone: "", password: "" });
  }}>
    <h2 className="font-heading text-lg font-semibold">Créer un compte transporteur</h2>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="partner-name">Nom</Label><Input id="partner-name" value={form.displayName} onChange={set("displayName")} required /></div>
      <div><Label htmlFor="partner-phone">Téléphone</Label><Input id="partner-phone" type="tel" value={form.phone} onChange={set("phone")} required /></div>
    </div>
    <div><Label htmlFor="partner-pin">PIN ou mot de passe temporaire</Label><Input id="partner-pin" value={form.password} onChange={set("password")} minLength={4} required /></div>
    <Button type="submit">Créer le compte</Button>
  </form>;
}

export default function Page() { return <SessionGate role="admin"><UsersAdmin /></SessionGate>; }
