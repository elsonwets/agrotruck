import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { Lang, Role } from "~/shared/domain";
import { clearQueryCache } from "./cached-query";
import { getOutbox } from "./outbox-client";

const TOKEN_KEY = "agrotrucks.session";
const USER_KEY = "agrotrucks.session.user"; // dernière session connue : on reste connecté hors ligne

export interface Session { userId: Id<"users">; role: Role; displayName: string }
type Status = "loading" | "authenticated" | "unauthenticated";

interface SessionValue {
  status: Status;
  session: Session | null;
  token: string | null;
  signIn: (token: string) => void;
  signOut: (lang: Lang) => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

// Espace d'accueil de chaque rôle.
export const homePath: Record<Role, "/$lang/admin" | "/$lang/transporter" | "/$lang/producer"> = {
  admin: "/$lang/admin",
  transporter: "/$lang/transporter",
  producer: "/$lang/producer",
};

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* stockage indisponible */ }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // undefined = pas encore lu (rendu serveur et premier rendu client identiques : pas de décalage d'hydratation).
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [cached, setCached] = useState<Session | null>(null);
  const live = useQuery(api.auth.session, token ? { token } : "skip");
  const logoutMutation = useMutation(api.auth.logout);

  useEffect(() => {
    const stored = read(TOKEN_KEY);
    const user = read(USER_KEY);
    // Lecture unique au montage : localStorage n'existe pas côté serveur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(stored);
    if (stored && user) setCached(JSON.parse(user) as Session);
  }, []);

  // Synchronise le stockage du téléphone avec la réponse du serveur (système externe : pas d'état React ici).
  useEffect(() => {
    if (live === undefined) return;
    if (live === null) {
      // Jeton refusé par le serveur (expiré, compte bloqué) : on l'oublie.
      write(TOKEN_KEY, null);
      write(USER_KEY, null);
    } else {
      write(USER_KEY, JSON.stringify(live));
    }
  }, [live]);

  const signIn = useCallback((next: string) => {
    write(TOKEN_KEY, next);
    setToken(next);
    setCached(null);
  }, []);

  const signOut = useCallback(async (lang: Lang) => {
    // Téléphone partagé : on envoie ce qui peut l'être, puis on efface la file, le cache et la session.
    const outbox = getOutbox();
    await outbox?.flush().catch(() => null);
    await outbox?.clear().catch(() => null);
    clearQueryCache();
    if (token) await logoutMutation({ token }).catch(() => null);
    write(TOKEN_KEY, null);
    write(USER_KEY, null);
    window.location.assign(`/${lang}`);
  }, [token, logoutMutation]);

  // Réponse du serveur si disponible ; sinon (hors ligne) la dernière session connue.
  const session = live !== undefined ? live : token ? cached : null;
  const status: Status = token === undefined ? "loading" : !token || live === null ? "unauthenticated" : session ? "authenticated" : "loading";

  const activeToken = live === null ? null : token ?? null;
  const value = useMemo(() => ({ status, session, token: activeToken, signIn, signOut }), [status, session, activeToken, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}

// Jeton garanti (à utiliser sous SessionGate).
export function useToken(): string {
  const { token } = useSession();
  if (!token) throw new Error("useToken used without a session");
  return token;
}
