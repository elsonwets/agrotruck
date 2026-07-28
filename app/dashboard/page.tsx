import type { Metadata } from "next";
import { OwnerDashboard } from "@/components/dashboard/owner-dashboard";

export const metadata: Metadata = { title: "Área do proprietário", description: "Protótipo de gestão de trucks AgroTruck." };

export default function DashboardPage() {
  return <div className="min-h-[70vh] bg-[#f8f8f5] pb-24 pt-12"><div className="page-shell"><p className="text-xs font-bold uppercase tracking-[.2em] text-danger">Protótipo proprietário</p><h1 className="mt-3 font-heading text-4xl font-extrabold tracking-[-.04em] md:text-5xl">Bom dia, Mamadú.</h1><p className="mt-3 max-w-2xl font-light text-muted-foreground">Atualize a disponibilidade da sua frota e acompanhe os contactos recebidos.</p><div className="mt-10"><OwnerDashboard /></div></div></div>;
}
