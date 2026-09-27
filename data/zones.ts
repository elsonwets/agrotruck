// Régions de Guinée-Bissau : liste fixe pour que « Gabu » et « Gabú » désignent la même zone.
export const zones = [
  { id: "bissau", label: "Bissau (SAB)" },
  { id: "biombo", label: "Biombo" },
  { id: "cacheu", label: "Cacheu" },
  { id: "oio", label: "Oio" },
  { id: "bafata", label: "Bafatá" },
  { id: "gabu", label: "Gabú" },
  { id: "quinara", label: "Quinara" },
  { id: "tombali", label: "Tombali" },
  { id: "bolama", label: "Bolama-Bijagós" },
] as const;

export type Zone = (typeof zones)[number]["id"];

export const zoneLabels = Object.fromEntries(zones.map(({ id, label }) => [id, label])) as Record<Zone, string>;

export function isZone(value: unknown): value is Zone {
  return zones.some((zone) => zone.id === value);
}
