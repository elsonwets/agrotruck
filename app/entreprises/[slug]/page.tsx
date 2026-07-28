import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Building2, Check, MapPin, PackageOpen, Scale, Truck } from "lucide-react";
import { CallButton } from "@/components/shared/call-button";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { TruckGrid } from "@/components/trucks/truck-grid";
import { findCompanyBySlug } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const company = await findCompanyBySlug((await params).slug); return { title: company?.name ?? "Empresa não encontrada", description: company ? `Consulte os trucks de ${company.name} disponíveis na AgroTruck.` : undefined }; }

export default async function CompanyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const company = await findCompanyBySlug((await params).slug);
  if (!company) notFound();
  return <main className="min-h-[70vh] bg-[#f8f8f5] pb-24">
    <section className="border-b border-primary/10 bg-white"><div className="page-shell py-8 md:py-12"><Link href="/entreprises" className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-primary/70 hover:text-primary"><ArrowLeft className="size-4" /> Todas as empresas</Link><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div className="flex items-start gap-4 md:gap-6"><span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary font-heading text-xl font-extrabold text-white shadow-[inset_0_-4px_0_#f2c500] md:size-20 md:text-2xl">{initials(company.name)}</span><div><div className="flex flex-wrap items-center gap-2"><h1 className="font-heading text-3xl font-extrabold tracking-[-.04em] md:text-5xl">{company.name}</h1>{company.verified && <span className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-xs font-bold text-primary"><BadgeCheck className="size-4" /> Verificada</span>}</div><p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4 text-primary" />Base em {company.headquarters} · operação regional</p></div></div><div className="grid grid-cols-2 gap-2 sm:flex"><WhatsappButton phone={company.whatsapp} truckName={`frota de ${company.name}`} className="w-full sm:w-auto" /><CallButton phone={company.phone} compact className="w-full sm:w-auto" /></div></div>
      <div className="mt-9 grid grid-cols-3 divide-x divide-primary/10 rounded-[18px] border border-primary/10 bg-[#f8f8f5]"><Fact icon={<Truck />} value={company.fleetSize} label="Trucks" /><Fact icon={<Check />} value={company.availableCount} label="Disponíveis" /><Fact icon={<Scale />} value={`${company.totalCapacityTons} t`} label="Capacidade" /></div></div></section>
    <div className="page-shell pt-12"><div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]"><section><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-danger">Frota registada</p><h2 className="mt-2 font-heading text-3xl font-extrabold tracking-[-.035em]">Trucks de {company.name}</h2></div><p className="text-sm text-muted-foreground">Disponíveis primeiro · contacto direto</p></div><div className="mt-7"><TruckGrid trucks={company.trucks} /></div></section><aside className="lg:order-last"><div className="rounded-[20px] border border-primary/10 bg-white p-6 lg:sticky lg:top-28"><h2 className="flex items-center gap-2 font-heading text-lg font-bold"><Building2 className="size-5 text-primary" />Áreas de operação</h2><div className="mt-5 flex flex-wrap gap-2">{company.serviceAreas.map((area) => <span key={area} className="rounded-full bg-primary/7 px-3 py-1.5 text-xs font-semibold text-primary">{area}</span>)}</div><div className="my-6 h-px bg-primary/10" /><h2 className="flex items-center gap-2 font-heading text-lg font-bold"><PackageOpen className="size-5 text-primary" />Mercadorias</h2><ul className="mt-4 space-y-2">{company.acceptedMaterials.map((material) => <li key={material} className="flex gap-2 text-sm font-light text-muted-foreground"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{material}</li>)}</ul></div></aside></div></div>
  </main>;
}

function Fact({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) { return <div className="px-3 py-4 text-center md:py-5"><span className="mx-auto block w-fit text-primary [&_svg]:size-4">{icon}</span><strong className="mt-2 block font-heading text-xl font-extrabold md:text-2xl">{value}</strong><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span></div>; }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase(); }
