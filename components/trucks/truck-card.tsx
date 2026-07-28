"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, MapPin, Scale } from "lucide-react";
import type { Truck } from "@/types/truck";
import { WhatsappButton } from "@/components/shared/whatsapp-button";
import { CallButton } from "@/components/shared/call-button";
import { companySlug } from "@/lib/companies";
import { TruckStatusBadge } from "./truck-status-badge";

export function TruckCard({ truck }: { truck: Truck }) {
  return <motion.article variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: .24, ease: "easeOut" }} whileHover={{ y: -2 }} className="group overflow-hidden rounded-[20px] border border-black/[.07] bg-white shadow-[0_12px_35px_rgba(11,61,46,.07)]">
    <Link href={`/trucks/${truck.slug}`} className="focus-ring relative block aspect-[16/9] overflow-hidden" aria-label={`Ver detalhes de ${truck.name}`}>
      <Image src={truck.images[0]} alt={`${truck.name} em ${truck.location}`} fill sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 560px" className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.018]"/>
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"/>
      <div className="absolute left-4 top-4"><TruckStatusBadge status={truck.availability}/></div>
    </Link>
    <div className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><h3 className="font-heading text-xl font-bold tracking-[-.025em] text-[#111111] md:text-2xl"><Link href={`/trucks/${truck.slug}`} className="focus-ring hover:text-primary">{truck.name}</Link></h3><p className="mt-1 flex items-center gap-1.5 text-sm text-[#667069]"><Building2 className="size-4"/>{truck.companyName ? <Link href={`/entreprises/${companySlug(truck.companyName)}`} className="focus-ring hover:text-primary">{truck.companyName}</Link> : truck.ownerName}</p></div>
        <div className="shrink-0 text-right"><strong className="font-heading text-lg font-bold text-primary">{truck.capacityTons} t</strong><span className="block text-[11px] uppercase tracking-wider text-[#7a817c]">capacidade</span></div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#5f6761]"><span className="flex items-center gap-1.5"><MapPin className="size-4 text-primary"/>{truck.location}</span><span className="flex items-center gap-1.5"><Scale className="size-4 text-primary"/>{truck.acceptedMaterials.slice(0, 3).join(" · ")}</span></div>
      <div className="mt-6 grid grid-cols-2 gap-2.5"><WhatsappButton phone={truck.whatsapp} truckName={truck.name}/><CallButton phone={truck.phone} compact/></div>
    </div>
  </motion.article>;
}
