"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SpaceNav } from "@/components/layout/space-nav";
import { homeForRole, useSession, type Role } from "@/lib/use-session";

const waiting = (text: string) => <div className="page-shell py-24 text-center text-sm text-muted-foreground">{text}</div>;

// Page réservée à un ou plusieurs rôles : sinon, retour à la connexion ou à son propre espace.
export function SessionGate({ role, children }: { role: Role | Role[]; children: React.ReactNode }) {
  const { status, session } = useSession();
  const router = useRouter();
  const allowed = session ? (Array.isArray(role) ? role : [role]).includes(session.role) : false;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && session && !allowed) router.replace(homeForRole[session.role]);
  }, [status, session, allowed, router]);

  if (status !== "authenticated" || !session || !allowed) return waiting("Vérification de la session…");
  return <>
    <Suspense fallback={<div className="h-[49px] border-b border-primary/10 bg-white" />}><SpaceNav /></Suspense>
    {children}
  </>;
}

// Page réservée aux visiteurs non connectés (connexion, inscription) : un compte connecté va dans son espace.
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { status, session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace(homeForRole[session.role]);
  }, [session, router]);

  if (status === "loading") return waiting("Chargement…");
  if (session) return waiting("Vous êtes déjà connecté — redirection vers votre espace…");
  return <>{children}</>;
}
