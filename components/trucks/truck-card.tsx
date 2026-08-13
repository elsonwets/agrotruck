"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Building2, MapPin, Package, Scale, UserRound } from "lucide-react";
import type { Truck } from "@/types/truck";
import { listingModeLabels, truckTypeLabels } from "@/types/truck";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { CallButton } from "@/components/shared/call-button";
import { companySlug } from "@/lib/companies";
import { TruckStatusBadge } from "./truck-status-badge";
import { TruckRating } from "./truck-rating";

export function TruckCard({ truck }: { truck: Truck }) {
  return <motion.article variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: .24, ease: "easeOut" }} whileHover={{ y: -2 }} className="group overflow-hidden rounded-[20px] border border-black/[.07] bg-white shadow-[0_12px_35px_rgba(11,61,46,.07)]">
    <Link href={`/trucks/${truck.slug}`} className="focus-ring relative block aspect-[16/9] overflow-hidden" aria-label={`Ver detalhes de ${truck.name}`}>
      <Image src={truck.images[0]} alt={`${truck.name} em ${truck.location}`} fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 560px" className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.018]"/>
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"/>
      <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-primary shadow-sm backdrop-blur">{truckTypeLabels[truck.type]}</span><span className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white shadow-sm ${truck.listingMode === "sale" ? "bg-danger" : truck.listingMode === "rental" ? "bg-[#b87400]" : "bg-primary"}`}>{listingModeLabels[truck.listingMode]}</span></div><TruckStatusBadge status={truck.availability}/></div>
    </Link>
    <div className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h3 className="font-heading text-xl font-bold tracking-[-.025em] text-[#111111] md:text-2xl"><Link href={`/trucks/${truck.slug}`} className="focus-ring hover:text-primary">{truck.name}</Link></h3><p className="mt-1.5 flex items-center gap-1.5 text-sm text-[#667069]">{truck.companyName ? <Building2 className="size-4"/> : <UserRound className="size-4"/>}{truck.companyName ? <Link href={`/entreprises/${companySlug(truck.companyName)}`} className="focus-ring hover:text-primary">{truck.companyName}</Link> : truck.ownerName}</p></div><Link href={`/trucks/${truck.slug}`} aria-label={`Ver ficha de ${truck.name}`} className="focus-ring grid size-9 shrink-0 place-items-center rounded-full border border-primary/10 text-primary transition hover:bg-primary hover:text-white"><ArrowUpRight className="size-4" /></Link></div>
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-primary/10 bg-primary/10"><div className="flex items-center gap-2 bg-[#f8f8f5] px-3 py-3"><MapPin className="size-4 shrink-0 text-primary"/><div><span className="block text-[10px] uppercase tracking-wider text-[#7a817c]">Localização</span><strong className="block truncate text-xs text-foreground">{truck.location}</strong></div></div><div className="flex items-center gap-2 bg-[#f8f8f5] px-3 py-3"><Scale className="size-4 shrink-0 text-primary"/><div><span className="block text-[10px] uppercase tracking-wider text-[#7a817c]">Capacidade</span><strong className="block text-xs text-foreground">{truck.capacityTons} toneladas</strong></div></div></div>
      <TruckRating ratings={truck.ratings} slug={truck.slug} className="mt-4 border-y border-primary/10 py-3" />
      <div className="mt-4"><p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#7a817c]"><Package className="size-3.5 text-primary" />Mercadorias aceites</p><div className="mt-2 flex flex-wrap gap-1.5">{truck.acceptedMaterials.slice(0, 2).map((material) => <span key={material} className="rounded-full bg-primary/6 px-2.5 py-1 text-[11px] font-medium text-primary">{material}</span>)}{truck.acceptedMaterials.length > 2 && <span className="rounded-full bg-primary/6 px-2.5 py-1 text-[11px] font-medium text-primary">+{truck.acceptedMaterials.length - 2}</span>}</div></div>
      <div className="mt-6 grid grid-cols-2 gap-2.5"><WhatsappButton phone={truck.whatsapp} truckName={truck.name}/><CallButton phone={truck.phone} compact/></div>
    </div>
  </motion.article>;
}
