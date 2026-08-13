import Image from "next/image";
import { Check, MapPin, Package, RotateCcw, TruckIcon } from "lucide-react";
import type { ListingMode, Truck, TruckType } from "@/types/truck";
import { listingModeLabels, truckTypeLabels } from "@/types/truck";
import { vehicleTypeOptions } from "@/data/vehicle-types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type TruckFilterState = {
  location: string;
  material: string;
  type: string;
  mode: string;
};

export const emptyFilters: TruckFilterState = { location: "", material: "", type: "", mode: "" };

type Props = {
  value: TruckFilterState;
  onChange: (value: TruckFilterState) => void;
  onReset: () => void;
  trucks: Truck[];
  lockedMode?: ListingMode;
};

export function TruckFilters({ value, onChange, onReset, trucks, lockedMode }: Props) {
  const locations = [...new Set(trucks.flatMap((truck) => [truck.location, ...truck.serviceAreas]))].sort();
  const materials = [...new Set(trucks.flatMap((truck) => truck.acceptedMaterials))].sort();
  const typeOptions = vehicleTypeOptions;
  const set = (key: keyof TruckFilterState, next: string) => onChange({ ...value, [key]: next });
  const activeCount = [value.location, value.material, value.type, lockedMode ? "" : value.mode].filter(Boolean).length;

  return <section aria-label="Filtros do anuário">
    <div className="grid gap-3 md:grid-cols-3 md:items-end">
      {!lockedMode && <Filter id="filter-mode" label="Que recherchez-vous ?" icon={<TruckIcon />}>
        <Select id="filter-mode" value={value.mode} onChange={(event) => set("mode", event.target.value)}>
          <option value="">Toutes les offres</option>
          {(Object.keys(listingModeLabels) as ListingMode[]).map((mode) => <option key={mode} value={mode}>{listingModeLabels[mode]}</option>)}
        </Select>
      </Filter>}
      <Filter id="filter-location" label="Onde precisa do camião?" icon={<MapPin />}>
        <Select id="filter-location" value={value.location} onChange={(event) => set("location", event.target.value)}>
          <option value="">Todas as zonas</option>
          {locations.map((location) => <option key={location}>{location}</option>)}
        </Select>
      </Filter>
      <Filter id="filter-material" label="O que deseja transportar?" icon={<Package />}>
        <Select id="filter-material" value={value.material} onChange={(event) => set("material", event.target.value)}>
          <option value="">Todas as mercadorias</option>
          {materials.map((material) => <option key={material}>{material}</option>)}
        </Select>
      </Filter>
      {activeCount > 0 && <Button type="button" variant="ghost" size="sm" onClick={onReset} className="h-11 shrink-0 md:col-span-3 md:justify-self-end">
        <RotateCcw className="size-4" /> Limpar ({activeCount})
      </Button>}
    </div>

    <div className="mt-6 border-t border-primary/10 pt-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div><p className="flex items-center gap-2 text-sm font-bold text-foreground"><TruckIcon className="size-4 text-primary" />Escolha o tipo de camião</p><p className="mt-1 text-xs text-muted-foreground">Deslize para comparar os modelos</p></div>
        {value.type && <button type="button" onClick={() => set("type", "")} className="focus-ring text-xs font-semibold text-primary hover:underline">Ver todos</button>}
      </div>
      <div className="scrollbar-thin -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3" role="list" aria-label="Tipos de camião">
        {typeOptions.map(({ type, image, description, group }) => {
          const selected = value.type === type;
          return <button key={type} type="button" aria-pressed={selected} onClick={() => set("type", selected ? "" : type)} className={cn("focus-ring group relative min-w-[210px] snap-start overflow-hidden rounded-2xl border bg-white text-left transition sm:min-w-[230px]", selected ? "border-primary shadow-[0_0_0_2px_rgba(11,61,46,.12)]" : "border-primary/10 hover:border-primary/30")}>
            <span className="relative block aspect-[16/9] overflow-hidden bg-primary/5"><Image src={image} alt="" fill sizes="170px" className="object-cover transition duration-300 group-hover:scale-[1.03]" /><span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />{selected && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-warning text-[#111]"><Check className="size-4" /></span>}</span>
            <span className="block px-3 py-3"><span className="block text-[10px] font-bold uppercase tracking-wider text-danger">{group}</span><span className="mt-1 block text-sm font-bold text-foreground">{truckTypeLabels[type as TruckType]}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span>
          </button>;
        })}
      </div>
    </div>
  </section>;
}

function Filter({ id, label, icon, children }: { id: string; label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="min-w-0 flex-1"><Label htmlFor={id} className="mb-2 flex items-center gap-2 text-xs font-bold text-foreground/75"><span className="text-primary [&_svg]:size-4">{icon}</span>{label}</Label>{children}</div>;
}
