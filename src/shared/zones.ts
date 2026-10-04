// Régions de Guinée-Bissau : liste fixe pour que « Gabu » et « Gabú » désignent la même zone.
// lat / lng : chef-lieu de la région, utilisé pour la barre de progression des trajets.
export const zones = [
  { id: "bissau", label: "Bissau (SAB)", lat: 11.8636, lng: -15.5977 },
  { id: "biombo", label: "Biombo", lat: 11.8833, lng: -15.85 },
  { id: "cacheu", label: "Cacheu", lat: 12.2667, lng: -16.1667 },
  { id: "oio", label: "Oio", lat: 12.4833, lng: -15.2167 },
  { id: "bafata", label: "Bafatá", lat: 12.1667, lng: -14.6667 },
  { id: "gabu", label: "Gabú", lat: 12.2833, lng: -14.2167 },
  { id: "quinara", label: "Quinara", lat: 11.5833, lng: -14.9833 },
  { id: "tombali", label: "Tombali", lat: 11.2833, lng: -15.25 },
  { id: "bolama", label: "Bolama-Bijagós", lat: 11.5778, lng: -15.4767 },
] as const;

export type Zone = (typeof zones)[number]["id"];

export const zoneLabels = Object.fromEntries(zones.map(({ id, label }) => [id, label])) as Record<Zone, string>;

export function isZone(value: unknown): value is Zone {
  return zones.some((zone) => zone.id === value);
}
