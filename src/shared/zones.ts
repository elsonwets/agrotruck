// Régions de Guinée-Bissau : liste fixe pour que « Gabu » et « Gabú » désignent la même zone.
// « center » : centre approximatif (latitude, longitude), pour deviner la région d'une position GPS.
export const zones = [
  { id: "bissau", label: "Bissau (SAB)", center: [11.86, -15.6] },
  { id: "biombo", label: "Biombo", center: [11.88, -15.82] },
  { id: "cacheu", label: "Cacheu", center: [12.2, -16.0] },
  { id: "oio", label: "Oio", center: [12.3, -15.3] },
  { id: "bafata", label: "Bafatá", center: [12.1, -14.75] },
  { id: "gabu", label: "Gabú", center: [12.2, -14.05] },
  { id: "quinara", label: "Quinara", center: [11.65, -15.15] },
  { id: "tombali", label: "Tombali", center: [11.25, -15.0] },
  { id: "bolama", label: "Bolama-Bijagós", center: [11.3, -15.9] },
] as const;

export type Zone = (typeof zones)[number]["id"];

export const zoneLabels = Object.fromEntries(zones.map(({ id, label }) => [id, label])) as Record<Zone, string>;

export function isZone(value: unknown): value is Zone {
  return zones.some((zone) => zone.id === value);
}

// Région dont le centre est le plus proche de la position (distance approximative, suffisante à cette échelle).
export function nearestZone(lat: number, lng: number): Zone {
  const distance = ([zoneLat, zoneLng]: readonly [number, number]) => (zoneLat - lat) ** 2 + ((zoneLng - lng) * Math.cos((lat * Math.PI) / 180)) ** 2;
  return zones.reduce((best, zone) => (distance(zone.center) < distance(best.center) ? zone : best)).id;
}
