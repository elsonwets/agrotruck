"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import type { Truck } from "@/types/truck";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { TruckGrid } from "./truck-grid";
import { TruckFilters, emptyFilters, type TruckFilterState } from "./truck-filters";

export function TrucksBrowser({ initialTrucks }: { initialTrucks: Truck[] }) {
  const params = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<TruckFilterState>(() => ({
    location: params.get("location") ?? "",
    material: params.get("material") ?? "",
    capacity: params.get("capacity") ?? "",
    availability: params.get("availability") ?? "",
  }));

  useEffect(() => {
    document.body.style.overflow = mobileFiltersOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileFiltersOpen]);

  const results = useMemo(() => initialTrucks.filter((truck) =>
    (!filters.location || truck.location === filters.location || truck.serviceAreas.includes(filters.location)) &&
    (!filters.material || truck.acceptedMaterials.includes(filters.material)) &&
    (!filters.capacity || truck.capacityTons >= Number(filters.capacity)) &&
    (!filters.availability || truck.availability === filters.availability)
  ), [filters, initialTrucks]);

  const reset = () => setFilters(emptyFilters);

  return (
    <>
      <div className="mb-8 hidden rounded-[20px] border border-primary/10 bg-white p-5 shadow-[0_18px_50px_rgba(17,17,17,.06)] lg:block">
        <TruckFilters value={filters} onChange={setFilters} onReset={reset} />
      </div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <strong className="text-lg font-semibold text-foreground">{results.length}</strong> truck{results.length !== 1 ? "s" : ""} encontrado{results.length !== 1 ? "s" : ""}
        </p>
        <Button type="button" variant="secondary" className="lg:hidden" onClick={() => setMobileFiltersOpen(true)}>
          <SlidersHorizontal className="size-4" /> Filtrar
        </Button>
      </div>
      {results.length ? <TruckGrid trucks={results} /> : <EmptyState onReset={reset} />}

      <AnimatePresence>
        {mobileFiltersOpen && (
          <motion.div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute inset-0 bg-black/50" aria-label="Fechar filtros" onClick={() => setMobileFiltersOpen(false)} />
            <motion.div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-[24px] bg-background p-5 shadow-2xl" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: .25, ease: "easeOut" }}>
              <div className="mb-6 flex items-center justify-between">
                <h2 id="mobile-filter-title" className="font-heading text-xl font-bold">Filtrar trucks</h2>
                <button className="focus-ring grid size-11 place-items-center rounded-full border border-primary/10" onClick={() => setMobileFiltersOpen(false)} aria-label="Fechar"><X className="size-5" /></button>
              </div>
              <TruckFilters value={filters} onChange={setFilters} onReset={reset} />
              <Button className="mt-3 w-full" size="lg" onClick={() => setMobileFiltersOpen(false)}>Ver {results.length} resultado{results.length !== 1 ? "s" : ""}</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
