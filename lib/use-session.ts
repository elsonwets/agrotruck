"use client";

import { useEffect, useState } from "react";

export type Role = "admin" | "partner" | "producer";
export interface Session { accountId: string; role: Role; displayName: string }
type Status = "loading" | "authenticated" | "unauthenticated";

// Espace d'accueil de chaque rôle après connexion.
export const homeForRole: Record<Role, string> = { admin: "/admin", partner: "/partner", producer: "/profil" };

export function useSession() {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/.netlify/functions/auth?action=session")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Session | null) => {
        if (cancelled) return;
        setSession(data);
        setStatus(data ? "authenticated" : "unauthenticated");
      })
      .catch(() => { if (!cancelled) setStatus("unauthenticated"); });
    return () => { cancelled = true; };
  }, []);

  return { status, session };
}
