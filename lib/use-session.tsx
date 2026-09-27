"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Role = "admin" | "partner" | "producer";
export interface Session { accountId: string; role: Role; displayName: string }
type Status = "loading" | "authenticated" | "unauthenticated";

// Espace d'accueil de chaque rôle après connexion.
export const homeForRole: Record<Role, string> = { admin: "/admin", partner: "/partner", producer: "/producteur" };

interface SessionValue {
  status: Status;
  session: Session | null;
  refresh: () => Promise<Session | null>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

function loadSession(): Promise<Session | null> {
  return fetch("/.netlify/functions/auth?action=session")
    .then((response) => (response.ok ? (response.json() as Promise<Session>) : null))
    .catch(() => null);
}

// Une seule lecture de session pour toute l'application (barre de navigation, espaces, pages de connexion).
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);

  const apply = useCallback((data: Session | null) => {
    setSession(data);
    setStatus(data ? "authenticated" : "unauthenticated");
    return data;
  }, []);

  const refresh = useCallback(async () => apply(await loadSession()), [apply]);

  const logout = useCallback(async () => {
    await fetch("/.netlify/functions/auth?action=logout", { method: "POST" }).catch(() => null);
    // Rechargement complet : on repart d'un état propre, sans page privée encore affichée.
    window.location.assign("/");
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadSession().then((data) => { if (!cancelled) apply(data); });
    return () => { cancelled = true; };
  }, [apply]);

  const value = useMemo(() => ({ status, session, refresh, logout }), [status, session, refresh, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession doit être utilisé dans SessionProvider");
  return value;
}
