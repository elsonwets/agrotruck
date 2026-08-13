import type { Metadata } from "next";
import { Suspense } from "react";
import { TrucksBrowser } from "@/components/trucks/trucks-browser";
import { listTrucks } from "@/lib/truck-directory";
export const dynamic = "force-dynamic";
export const metadata:Metadata={title:"Encontrar um truck",description:"Pesquise trucks disponíveis na Guiné-Bissau e contacte diretamente o proprietário."};
export default async function TrucksPage(){const trucks=await listTrucks();return <div className="page-shell pb-24 pt-12 md:pt-16"><div className="mb-10 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-danger">Trucks disponíveis</p><h1 className="mt-3 font-heading text-4xl font-extrabold tracking-[-.04em] text-foreground md:text-6xl">Encontre o truck certo perto de si.</h1><p className="mt-4 max-w-2xl font-light leading-7 text-muted-foreground">Filtre os veículos e fale diretamente com o proprietário. Sem reserva e sem intermediários.</p></div><Suspense fallback={<div className="h-96 animate-pulse rounded-[20px] bg-primary/5"/>}><TrucksBrowser initialTrucks={trucks}/></Suspense></div>}
