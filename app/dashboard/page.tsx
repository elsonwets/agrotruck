import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OwnerDashboard } from "@/components/dashboard/owner-dashboard";
import { auth } from "@/lib/auth";
import { listOwnerTrucks } from "@/db/queries";

export const metadata: Metadata = { title: "Área do proprietário", description: "Protótipo de gestão de trucks AgroTruck." };

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/devenir-partenaire");
  const trucks = await listOwnerTrucks(session.user.id);
  const displayName = session.user.name || session.user.email.split("@")[0];
  return <div className="min-h-[70vh] bg-[#f8f8f5] pb-24 pt-12"><div className="page-shell"><p className="text-xs font-bold uppercase tracking-[.2em] text-danger">Área do proprietário</p><h1 className="mt-3 font-heading text-4xl font-extrabold tracking-[-.04em] md:text-5xl">Bom dia, {displayName}.</h1><p className="mt-3 max-w-2xl font-light text-muted-foreground">Acompanhe a validação, a equipa e a disponibilidade da sua frota.</p><div className="mt-10"><OwnerDashboard initialTrucks={trucks} isCompany={session.user.accountType === "company"} /></div></div></div>;
}
