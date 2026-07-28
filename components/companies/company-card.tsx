"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, BadgeCheck, MapPin, PackageOpen, Truck } from "lucide-react";
import type { TransportCompany } from "@/types/company";

export function CompanyCard({ company }: { company: TransportCompany }) {
  return <motion.article variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } }} transition={{ duration: .24, ease: "easeOut" }} whileHover={{ y: -3 }} className="group overflow-hidden rounded-[20px] border border-primary/10 bg-white shadow-[0_14px_40px_rgba(11,61,46,.07)]">
    <Link href={`/entreprises/${company.slug}`} className="focus-ring relative block aspect-[16/7] overflow-hidden" aria-label={`Ver a frota de ${company.name}`}>
      <Image src={company.coverImage} alt={`Frota de ${company.name}`} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#071f17]/80 via-[#071f17]/20 to-transparent" />
      <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
        <span className="grid size-12 place-items-center rounded-xl border border-white/20 bg-white/95 font-heading text-lg font-extrabold text-primary shadow-sm">{initials(company.name)}</span>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${company.availableCount ? "bg-[#dcf7e9] text-[#087044]" : "bg-white/90 text-[#5f6761]"}`}>{company.availableCount ? `${company.availableCount} ${company.availableCount > 1 ? "disponíveis" : "disponível"}` : "Frota registada"}</span>
      </div>
    </Link>
    <div className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-1.5"><h2 className="font-heading text-xl font-bold tracking-[-.025em] text-foreground md:text-2xl"><Link href={`/entreprises/${company.slug}`} className="focus-ring hover:text-primary">{company.name}</Link></h2>{company.verified && <BadgeCheck className="size-5 shrink-0 text-primary" aria-label="Empresa verificada" />}</div><p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-4 text-primary" />{company.headquarters}</p></div><ArrowUpRight className="mt-1 size-5 shrink-0 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
      <div className="mt-5 grid grid-cols-2 divide-x divide-primary/10 rounded-xl bg-primary/[.045] py-3"><span className="flex items-center justify-center gap-2 text-sm text-foreground/75"><Truck className="size-4 text-primary" /><strong>{company.fleetSize}</strong> truck{company.fleetSize > 1 ? "s" : ""}</span><span className="flex items-center justify-center gap-2 text-sm text-foreground/75"><PackageOpen className="size-4 text-primary" /><strong>{company.totalCapacityTons}</strong> t</span></div>
      <p className="mt-5 line-clamp-2 text-sm font-light leading-6 text-muted-foreground">{company.acceptedMaterials.slice(0, 4).join(" · ")}</p>
      <Link href={`/entreprises/${company.slug}`} className="focus-ring mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">Ver todos os trucks <ArrowUpRight className="size-4" /></Link>
    </div>
  </motion.article>;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}
