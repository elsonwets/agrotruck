import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SpaceNav } from "~/components/layout/space-nav";
import { useLang, useT } from "~/lib/i18n";
import { homePath, useSession } from "~/lib/session";
import type { Role } from "~/shared/domain";

function Waiting({ text }: { text: string }) {
  return <p className="container-page py-24 text-center text-muted">{text}</p>;
}

// Page réservée à un ou plusieurs rôles : sinon, retour à la connexion ou à son propre espace.
export function SessionGate({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { status, session } = useSession();
  const navigate = useNavigate();
  const lang = useLang();
  const t = useT();
  const allowed = session ? roles.includes(session.role) : false;

  useEffect(() => {
    if (status === "unauthenticated") void navigate({ to: "/$lang/login", params: { lang }, replace: true });
    if (status === "authenticated" && session && !allowed) void navigate({ to: homePath[session.role], params: { lang }, replace: true });
  }, [status, session, allowed, navigate, lang]);

  if (status !== "authenticated" || !allowed) return <Waiting text={t.space.checking} />;
  return <>
    <SpaceNav />
    <div className="container-page py-8 sm:py-10">{children}</div>
  </>;
}

// Connexion et inscription : un compte déjà connecté est envoyé vers son espace.
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { status, session } = useSession();
  const navigate = useNavigate();
  const lang = useLang();
  const t = useT();

  useEffect(() => {
    if (session) void navigate({ to: homePath[session.role], params: { lang }, replace: true });
  }, [session, navigate, lang]);

  if (session) return <Waiting text={t.auth.alreadyLoggedIn} />;
  // Pendant la lecture de la session, le formulaire reste affiché (rendu serveur utile) mais inactif.
  return <div aria-busy={status === "loading"}>{children}</div>;
}
