import type { Metadata } from "next";
import { Building2, CheckCircle2, Truck } from "lucide-react";
import { CompaniesBrowser } from "@/components/companies/companies-browser";
import { listCompanies } from "@/lib/truck-directory";

export const metadata: Metadata = { title: "Empresas de transporte", description: "Descubra empresas de transporte e consulte os trucks disponíveis em cada frota." };
export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await listCompanies();
  const fleetSize = companies.reduce((total, company) => total + company.fleetSize, 0);
  const available = companies.reduce((total, company) => total + company.availableCount, 0);
  return <main className="min-h-[70vh] bg-[#f8f8f5] pb-24">
    <section className="relative overflow-hidden bg-primary py-14 text-white md:py-20"><div className="absolute inset-x-0 top-0 brand-road rounded-none" /><div className="page-shell relative"><p className="text-xs font-bold uppercase tracking-[.2em] text-warning">Rede AgroTruck</p><div className="mt-4 grid items-end gap-8 lg:grid-cols-[1fr_auto]"><div className="max-w-3xl"><h1 className="font-heading text-4xl font-extrabold tracking-[-.045em] text-white md:text-6xl">Empresas de transporte, organizadas por frota.</h1><p className="mt-5 max-w-2xl font-light leading-7 text-white/72">Compare empresas, veja onde operam e abra a frota para contactar diretamente o truck certo.</p></div><div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/15 bg-white/15"><Stat icon={<Building2 />} value={companies.length} label="Empresas" /><Stat icon={<Truck />} value={fleetSize} label="Trucks" /><Stat icon={<CheckCircle2 />} value={available} label="Disponíveis" /></div></div></div></section>
    <section className="page-shell pt-10 md:pt-14"><CompaniesBrowser companies={companies} /></section>
  </main>;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) { return <div className="min-w-24 bg-primary px-4 py-4 text-center md:min-w-28"><span className="mx-auto block w-fit text-warning [&_svg]:size-4">{icon}</span><strong className="mt-2 block font-heading text-2xl font-extrabold">{value}</strong><span className="block text-[10px] uppercase tracking-wider text-white/60">{label}</span></div>; }
