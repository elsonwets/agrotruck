import { RotateCcw } from "lucide-react";
import { availabilityLabels } from "@/types/truck";
import { locations, materials } from "@/data/trucks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type TruckFilterState = {
  location: string;
  material: string;
  capacity: string;
  availability: string;
};

export const emptyFilters: TruckFilterState = {
  location: "",
  material: "",
  capacity: "",
  availability: "",
};

type Props = {
  value: TruckFilterState;
  onChange: (value: TruckFilterState) => void;
  onReset: () => void;
};

export function TruckFilters({ value, onChange, onReset }: Props) {
  const set = (key: keyof TruckFilterState, next: string) =>
    onChange({ ...value, [key]: next });

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Filter id="filter-location" label="Localização">
          <Select id="filter-location" value={value.location} onChange={(event) => set("location", event.target.value)}>
            <option value="">Todas as zonas</option>
            {locations.map((location) => <option key={location}>{location}</option>)}
          </Select>
        </Filter>
        <Filter id="filter-material" label="Mercadoria">
          <Select id="filter-material" value={value.material} onChange={(event) => set("material", event.target.value)}>
            <option value="">Todas as mercadorias</option>
            {materials.map((material) => <option key={material}>{material}</option>)}
          </Select>
        </Filter>
        <Filter id="filter-capacity" label="Capacidade mínima">
          <Input id="filter-capacity" type="number" inputMode="numeric" min="0" placeholder="Ex.: 20 toneladas" value={value.capacity} onChange={(event) => set("capacity", event.target.value)} />
        </Filter>
        <Filter id="filter-availability" label="Disponibilidade">
          <Select id="filter-availability" value={value.availability} onChange={(event) => set("availability", event.target.value)}>
            <option value="">Todos os estados</option>
            {Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Filter>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="size-4" /> Limpar filtros
        </Button>
      </div>
    </div>
  );
}

function Filter({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div><Label htmlFor={id}>{label}</Label>{children}</div>;
}
