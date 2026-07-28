"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, MessageCircle, Plus, Truck as TruckIcon } from "lucide-react";
import { trucks as demoTrucks } from "@/data/trucks";
import type { TruckAvailability } from "@/types/truck";
import { availabilityLabels } from "@/types/truck";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TruckStatusBadge } from "@/components/trucks/truck-status-badge";

export function OwnerDashboard() {
  const initial = demoTrucks.filter((truck) => truck.companyName === "TransGuiné Logística" || truck.ownerName === "Mamadú Baldé").concat(demoTrucks[4]);
  const [fleet, setFleet] = useState(initial);

  function updateStatus(id: string, availability: TruckAvailability) {
    setFleet((current) => current.map((truck) => truck.id === id ? { ...truck, availability } : truck));
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<TruckIcon />} value={fleet.length} label="Trucks publicados" />
        <Metric icon={<MessageCircle />} value={12} label="Contactos este mês" />
        <Metric icon={<Eye />} value={284} label="Visualizações" />
      </div>
      <section className="mt-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-danger">A sua frota</p><h2 className="mt-2 font-heading text-2xl font-bold tracking-[-.03em] md:text-3xl">Disponibilidade dos trucks</h2></div>
          <Button asChild><Link href="/devenir-partenaire"><Plus className="size-4" /> Adicionar truck</Link></Button>
        </div>
        <div className="mt-6 overflow-hidden rounded-[20px] border border-primary/10 bg-white">
          {fleet.map((truck, index) => (
            <article key={truck.id} className={`grid gap-5 p-4 md:grid-cols-[130px_1fr_220px] md:items-center md:p-5 ${index ? "border-t border-primary/10" : ""}`}>
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-primary/5"><Image src={truck.images[0]} alt={truck.name} fill sizes="130px" className="object-cover" /></div>
              <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-heading font-semibold text-foreground">{truck.name}</h3><TruckStatusBadge status={truck.availability} /></div><p className="mt-2 text-sm font-light text-muted-foreground">{truck.location} · {truck.capacityTons} toneladas</p></div>
              <div><label htmlFor={`status-${truck.id}`} className="mb-1.5 block text-xs font-semibold text-foreground/70">Alterar disponibilidade</label><Select id={`status-${truck.id}`} value={truck.availability} onChange={(event) => updateStatus(truck.id, event.target.value as TruckAvailability)}>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return <div className="rounded-[20px] border border-primary/10 bg-white p-5"><span className="grid size-10 place-items-center rounded-full bg-primary/8 text-primary [&_svg]:size-5">{icon}</span><strong className="mt-6 block font-heading text-3xl font-bold tracking-[-.04em]">{value}</strong><span className="mt-1 block text-sm font-light text-muted-foreground">{label}</span></div>;
}
