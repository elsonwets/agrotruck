import type { Metadata } from "next";
import { Suspense } from "react";
import { TrucksBrowser } from "@/components/trucks/trucks-browser";
import { OrderRequestForm } from "@/components/location/order-request-form";
import { listTrucks } from "@/lib/truck-directory";

export const metadata: Metadata = { title: "Location de véhicules", description: "Demandez des camions, voitures et engins à la location auprès de Badora." };

const fallback = <div className="h-96 animate-pulse rounded-[20px] bg-primary/5" />;

export default async function RentalPage() {
  const vehicles = await listTrucks();
  return <main className="min-h-[70vh] bg-[#f8f8f5] pb-24 pt-12"><div className="page-shell">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-[#b87400]">Location de véhicules</p>
    <h1 className="mt-3 max-w-3xl font-heading text-4xl font-extrabold tracking-[-.04em] md:text-6xl">Louez le véhicule adapté à votre trajet.</h1>
    <p className="mb-8 mt-4 max-w-2xl font-light leading-7 text-muted-foreground">Décrivez votre besoin, Badora s&apos;occupe du reste — sa flotte ou celle de ses partenaires.</p>
    <div id="demande" className="mb-12 max-w-2xl scroll-mt-28"><Suspense fallback={fallback}><OrderRequestForm /></Suspense></div>
    <h2 className="mb-5 font-heading text-2xl font-bold text-foreground">Véhicules disponibles à la location</h2>
    <Suspense fallback={fallback}><TrucksBrowser initialTrucks={vehicles} mode="rental" /></Suspense>
  </div></main>;
}
