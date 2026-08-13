import type { Metadata } from "next";
import { Suspense } from "react";
import { TrucksBrowser } from "@/components/trucks/trucks-browser";
import { listTrucks } from "@/lib/truck-directory";

export const metadata: Metadata = { title: "Véhicules à vendre", description: "Consultez les camions, voitures et engins proposés à la vente." };
export default async function SalePage() {
  const vehicles = await listTrucks();
  return <main className="min-h-[70vh] bg-[#f8f8f5] pb-24 pt-12"><div className="page-shell"><p className="text-xs font-bold uppercase tracking-[.2em] text-danger">Véhicules à vendre</p><h1 className="mt-3 max-w-3xl font-heading text-4xl font-extrabold tracking-[-.04em] md:text-6xl">Trouvez votre prochain véhicule.</h1><p className="mb-10 mt-4 max-w-2xl font-light leading-7 text-muted-foreground">Comparez les offres et contactez directement le vendeur par téléphone ou WhatsApp.</p><Suspense fallback={<div className="h-96 animate-pulse rounded-[20px] bg-primary/5"/>}><TrucksBrowser initialTrucks={vehicles} mode="sale"/></Suspense></div></main>;
}
