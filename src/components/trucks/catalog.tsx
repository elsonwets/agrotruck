import { Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import { buttonClass } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/card";
import { Select } from "~/components/ui/form";
import { useLang, useT } from "~/lib/i18n";
import { LISTING_MODES, VEHICLE_CATEGORIES, type ListingMode, type VehicleCategory } from "~/shared/domain";
import { isZone, zones, type Zone } from "~/shared/zones";
import { CategoryPicker } from "./category-picker";
import { TruckCard } from "./truck-card";

export interface CatalogSearch { category?: VehicleCategory; zone?: Zone; mode?: ListingMode }

// Paramètres d'URL du catalogue (partageables et lus au rendu serveur).
export function validateCatalogSearch(search: Record<string, unknown>): CatalogSearch {
  return {
    category: VEHICLE_CATEGORIES.includes(search.category as VehicleCategory) ? (search.category as VehicleCategory) : undefined,
    zone: isZone(search.zone) ? search.zone : undefined,
    mode: LISTING_MODES.includes(search.mode as ListingMode) ? (search.mode as ListingMode) : undefined,
  };
}

export const catalogQuery = (search: CatalogSearch, lockedMode?: ListingMode) =>
  convexQuery(api.trucks.list, { category: search.category, zone: search.zone, listingMode: lockedMode ?? search.mode });

export function Catalog({ search, lockedMode }: { search: CatalogSearch; lockedMode?: ListingMode }) {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const { data: trucks } = useSuspenseQuery(catalogQuery(search, lockedMode));
  const update = (patch: Partial<CatalogSearch>) =>
    void navigate({ to: ".", search: (current: CatalogSearch) => ({ ...current, ...patch }), replace: true, resetScroll: false });

  return <div className="grid gap-10">
    <CategoryPicker value={search.category} onChange={(category) => update({ category })} />

    <section aria-labelledby="catalog-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="catalog-title" className="text-xl font-bold text-ink">{t.home.catalogTitle}</h2>
          <p className="mt-1 text-sm text-muted" aria-live="polite">{t.home.results(trucks.length)}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-none sm:grid-flow-col">
          <label className="text-sm font-semibold">
            <span className="sr-only">{t.home.filterZone}</span>
            <Select value={search.zone ?? ""} onChange={(event) => update({ zone: (event.target.value || undefined) as Zone | undefined })} className="sm:w-52">
              <option value="">{t.home.allZones}</option>
              {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.label}</option>)}
            </Select>
          </label>
          {!lockedMode && <label className="text-sm font-semibold">
            <span className="sr-only">{t.home.filterMode}</span>
            <Select value={search.mode ?? ""} onChange={(event) => update({ mode: (event.target.value || undefined) as ListingMode | undefined })} className="sm:w-48">
              <option value="">{t.home.allModes}</option>
              {LISTING_MODES.map((mode) => <option key={mode} value={mode}>{t.modes[mode]}</option>)}
            </Select>
          </label>}
        </div>
      </div>

      <div className="mt-6">
        {trucks.length
          ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{trucks.map((truck) => <TruckCard key={truck._id} truck={truck} />)}</div>
          : <EmptyState title={t.home.emptyTitle} text={t.home.emptyText}
              action={<Link to="/$lang/producer/new" params={{ lang }} search={{ category: search.category }} className={buttonClass("primary")}>{t.home.emptyCta}</Link>} />}
      </div>
    </section>
  </div>;
}
