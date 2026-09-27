import { Check } from "lucide-react";
import { VehicleIcon } from "~/components/vehicle-icon";
import { cn } from "~/lib/cn";
import { useT } from "~/lib/i18n";
import { VEHICLE_CATEGORIES, type VehicleCategory } from "~/shared/domain";

// « Choisissez le type de véhicule » : les 5 types qu'on connaît tous, le camion d'abord. Défilement horizontal sur mobile.
export function CategoryPicker({ value, onChange }: { value?: VehicleCategory; onChange: (value: VehicleCategory | undefined) => void }) {
  const t = useT();
  return <section aria-labelledby="category-title">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 id="category-title" className="text-xl font-bold text-ink">{t.home.categoriesTitle}</h2>
        <p className="mt-1 text-sm text-muted">{t.home.categoriesHint}</p>
      </div>
      {value && <button type="button" onClick={() => onChange(undefined)} className="text-sm font-semibold text-brand-700 hover:underline">{t.home.resetFilters}</button>}
    </div>
    <div role="list" className="scroll-row -mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
      {VEHICLE_CATEGORIES.map((category) => {
        const selected = value === category;
        return <button key={category} role="listitem" type="button" aria-pressed={selected} onClick={() => onChange(selected ? undefined : category)}
          className={cn("relative flex min-w-[9.5rem] snap-start flex-col items-start gap-3 rounded-2xl border bg-white p-4 text-left sm:min-w-0",
            selected ? "border-brand-800 ring-2 ring-brand-800" : "border-line hover:border-brand-200")}>
          <span className={cn("grid size-12 place-items-center rounded-xl", selected ? "bg-brand-800 text-white" : "bg-brand-50 text-brand-800")}>
            <VehicleIcon category={category} className="size-7" strokeWidth={1.7} />
          </span>
          <span>
            <span className="block font-semibold text-ink">{t.categories[category].label}</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted">{t.categories[category].hint}</span>
          </span>
          {selected && <Check className="absolute right-3 top-3 size-5 text-brand-800" aria-hidden="true" />}
        </button>;
      })}
    </div>
  </section>;
}
