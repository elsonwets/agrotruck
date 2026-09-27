import type { TruckType } from "../types/truck";

export type VehicleCategory = "camion" | "camionnette" | "moto_tricycle" | "tracteur" | "semi_remorque";

// Catégories de mission « comme on les appelle ici », dans l'ordre d'affichage (le camion d'abord).
export const vehicleCategories: { id: VehicleCategory; label: string; truckTypes: TruckType[] }[] = [
  { id: "camion", label: "Camion", truckTypes: ["flatbed", "covered", "dump_truck", "cargo", "refrigerated", "tanker", "container"] },
  { id: "camionnette", label: "Camionnette / pick-up", truckTypes: ["pickup"] },
  { id: "moto_tricycle", label: "Moto tricycle", truckTypes: ["cargo_tricycle"] },
  { id: "tracteur", label: "Tracteur + remorque", truckTypes: ["agricultural_tractor", "farm_trailer"] },
  { id: "semi_remorque", label: "Semi-remorque (gros tonnage)", truckTypes: ["road_tractor", "flatbed_trailer", "covered_trailer"] },
];

export const vehicleCategoryLabels = Object.fromEntries(vehicleCategories.map(({ id, label }) => [id, label])) as Record<VehicleCategory, string>;

export function categoryOfTruckType(type: TruckType): VehicleCategory | null {
  return vehicleCategories.find((category) => category.truckTypes.includes(type))?.id ?? null;
}
