"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, type Role } from "@/lib/use-session";

export function SessionGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const { status, session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && session?.role !== role) router.replace("/login");
  }, [status, session, role, router]);

  if (status !== "authenticated" || session?.role !== role) {
    return <div className="page-shell py-24 text-center text-sm text-muted-foreground">Vérification de la session…</div>;
  }
  return <>{children}</>;
}
