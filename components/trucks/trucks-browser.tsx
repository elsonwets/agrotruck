"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Truck } from "@/types/truck";
import { EmptyState } from "@/components/shared/empty-state";
import { TruckGrid } from "./truck-grid";
import { TruckFilters, emptyFilters, type TruckFilterState } from "./truck-filters";

export function TrucksBrowser({ initialTrucks }: { initialTrucks: Truck[] }) {
  const params = useSearchParams();
  const [filters, setFilters] = useState<TruckFilterState>(() => ({
    location: params.get("location") ?? "",
    material: params.get("material") ?? "",
    type: params.get("type") ?? "",
  }));

  const results = useMemo(() => initialTrucks.filter((truck) =>
    (!filters.location || truck.location === filters.location || truck.serviceAreas.includes(filters.location)) &&
    (!filters.material || truck.acceptedMaterials.includes(filters.material)) &&
    (!filters.type || truck.type === filters.type)
  ), [filters, initialTrucks]);

  const reset = () => setFilters(emptyFilters);

  return <>
    <div className="mb-7 rounded-[22px] border border-primary/10 bg-white p-4 shadow-[0_18px_50px_rgba(17,17,17,.06)] sm:p-5">
      <TruckFilters value={filters} onChange={setFilters} onReset={reset} trucks={initialTrucks} />
    </div>
    <div className="mb-6 flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite"><strong className="text-lg font-semibold text-foreground">{results.length}</strong> truck{results.length !== 1 ? "s" : ""} encontrado{results.length !== 1 ? "s" : ""}</p>
      <p className="hidden text-xs text-muted-foreground sm:block">Contacto direto · sem intermediário</p>
    </div>
    {results.length ? <TruckGrid trucks={results} /> : <EmptyState onReset={reset} />}
  </>;
}
