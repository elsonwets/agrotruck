"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { homeForRole, useSession, type Role } from "@/lib/use-session";

export function SessionGate({ role, children }: { role: Role | Role[]; children: React.ReactNode }) {
  const { status, session } = useSession();
  const router = useRouter();
  const allowed = session ? (Array.isArray(role) ? role : [role]).includes(session.role) : false;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && session && !allowed) router.replace(homeForRole[session.role]);
  }, [status, session, allowed, router]);

  if (status !== "authenticated" || !session || !allowed) {
    return <div className="page-shell py-24 text-center text-sm text-muted-foreground">Vérification de la session…</div>;
  }

  const logout = async () => {
    await fetch("/.netlify/functions/auth?action=logout", { method: "POST" });
    router.replace("/login");
  };

  return <>
    <div className="page-shell flex items-center justify-end gap-3 pt-6 text-sm text-muted-foreground">
      <span>Connecté : <strong className="text-foreground">{session.displayName}</strong></span>
      <Link href="/profil" className="focus-ring font-semibold text-primary hover:underline">Mon profil</Link>
      <button type="button" onClick={logout} className="focus-ring font-semibold text-primary hover:underline">Se déconnecter</button>
    </div>
    {children}
  </>;
}
