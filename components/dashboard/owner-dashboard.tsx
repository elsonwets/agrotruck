"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Clock3, Plus, Truck as TruckIcon } from "lucide-react";
import { updateTruckAvailability } from "@/app/actions/partners";
import type { OwnerTruck, TruckAvailability } from "@/types/truck";
import { availabilityLabels } from "@/types/truck";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TruckStatusBadge } from "@/components/trucks/truck-status-badge";

export function OwnerDashboard({ initialTrucks }: { initialTrucks: OwnerTruck[] }) {
  const [fleet, setFleet] = useState(initialTrucks);
  const [error, setError] = useState("");
  const published = fleet.filter((truck) => truck.publicationStatus === "published").length;
  const pending = fleet.filter((truck) => truck.publicationStatus === "pending_payment").length;

  async function updateStatus(id: string, availability: TruckAvailability) {
    const truck = fleet.find((item) => item.id === id);
    if (!truck) return;
    const previous = truck.availability;
    setFleet((current) => current.map((item) => item.id === id ? { ...item, availability } : item));
    const result = await updateTruckAvailability(truck.registration, availability);
    if (!result.success) { setFleet((current) => current.map((item) => item.id === id ? { ...item, availability: previous } : item)); setError(result.error); } else setError("");
  }

  return <div>
    <div className="grid gap-3 sm:grid-cols-3"><Metric icon={<TruckIcon/>} value={fleet.length} label="Trucks cadastrados"/><Metric icon={<CheckCircle2/>} value={published} label="Online"/><Metric icon={<Clock3/>} value={pending} label="Offline · pagamento pendente"/></div>
    <section className="mt-10"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-danger">A sua frota</p><h2 className="mt-2 font-heading text-2xl font-bold tracking-[-.03em] md:text-3xl">Gestão dos trucks</h2></div><Button asChild><Link href="/devenir-partenaire"><Plus className="size-4"/>Adicionar truck</Link></Button></div>
      {error && <p role="alert" className="mt-4 text-sm font-medium text-danger">{error}</p>}
      {fleet.length ? <div className="mt-6 overflow-hidden rounded-[20px] border border-primary/10 bg-white">{fleet.map((truck,index)=><article key={truck.id} className={`grid gap-5 p-4 md:grid-cols-[130px_1fr_220px] md:items-center md:p-5 ${index ? "border-t border-primary/10" : ""}`}><div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-primary/5"><Image src={truck.images[0]} alt={truck.name} fill sizes="130px" className="object-cover"/></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-heading font-semibold">{truck.name}</h3><PublicationBadge status={truck.publicationStatus}/></div><p className="mt-2 text-sm font-light text-muted-foreground">{truck.location} · {truck.capacityTons} toneladas · {truck.registration}</p><div className="mt-2"><TruckStatusBadge status={truck.availability}/></div></div><div><label htmlFor={`status-${truck.id}`} className="mb-1.5 block text-xs font-semibold text-foreground/70">Disponibilidade</label><Select id={`status-${truck.id}`} value={truck.availability} onChange={(event)=>updateStatus(truck.id,event.target.value as TruckAvailability)}>{Object.entries(availabilityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</Select></div></article>)}</div> : <div className="mt-6 rounded-[20px] border border-dashed border-primary/20 bg-white px-6 py-14 text-center"><TruckIcon className="mx-auto size-10 text-primary/40"/><h3 className="mt-4 font-heading text-xl font-bold">Ainda não tem trucks</h3><Button asChild className="mt-5"><Link href="/devenir-partenaire">Cadastrar o primeiro truck</Link></Button></div>}
    </section>
  </div>;
}

function PublicationBadge({ status }: { status: OwnerTruck["publicationStatus"] }) { const labels={pending_payment:"Offline · pagamento pendente",published:"Online",rejected:"Offline · recusado"}; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${status === "published" ? "bg-emerald-100 text-emerald-700" : status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{labels[status]}</span>; }
function Metric({icon,value,label}:{icon:React.ReactNode;value:number;label:string}){return <div className="rounded-[20px] border border-primary/10 bg-white p-5"><span className="grid size-10 place-items-center rounded-full bg-primary/8 text-primary [&_svg]:size-5">{icon}</span><strong className="mt-6 block font-heading text-3xl font-bold">{value}</strong><span className="mt-1 block text-sm font-light text-muted-foreground">{label}</span></div>;}
