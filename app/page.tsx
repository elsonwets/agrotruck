import { Suspense } from "react";
import { TrucksBrowser } from "@/components/trucks/trucks-browser";
import { listTrucks } from "@/db/queries";

export default async function HomePage() {
  const trucks = await listTrucks();
  return <div className="min-h-[70vh] bg-[#f8f8f5] pb-24 pt-10 md:pt-14">
    <div className="page-shell">
      <div className="mb-9 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-danger">Trucks disponíveis</p>
        <h1 className="mt-3 font-heading text-4xl font-extrabold tracking-[-.045em] text-foreground md:text-6xl">Encontre um truck disponível perto de si.</h1>
        <p className="mt-4 max-w-2xl font-light leading-7 text-muted-foreground">Filtre por localização, mercadoria, capacidade ou disponibilidade e contacte diretamente o proprietário.</p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[20px] bg-primary/5" />}><TrucksBrowser initialTrucks={trucks} /></Suspense>
    </div>
  </div>;
}
