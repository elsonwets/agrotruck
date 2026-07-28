import type { TransportCompany } from "@/types/company";
import type { Truck } from "@/types/truck";

export function groupTrucksByCompany(trucks: Truck[]): TransportCompany[] {
  const groups = new Map<string, Truck[]>();
  for (const truck of trucks) {
    if (!truck.companyName) continue;
    groups.set(truck.companyName, [...(groups.get(truck.companyName) ?? []), truck]);
  }

  return [...groups.entries()].map(([name, fleet]) => {
    const sortedFleet = [...fleet].sort((a, b) => Number(b.availability === "available") - Number(a.availability === "available"));
    return {
      slug: slugify(name),
      name,
      headquarters: sortedFleet[0].location,
      phone: sortedFleet[0].phone,
      whatsapp: sortedFleet[0].whatsapp,
      verified: sortedFleet.every((truck) => truck.verified),
      fleetSize: sortedFleet.length,
      availableCount: sortedFleet.filter((truck) => truck.availability === "available").length,
      totalCapacityTons: sortedFleet.reduce((total, truck) => total + truck.capacityTons, 0),
      serviceAreas: unique(sortedFleet.flatMap((truck) => truck.serviceAreas)),
      acceptedMaterials: unique(sortedFleet.flatMap((truck) => truck.acceptedMaterials)),
      coverImage: sortedFleet[0].images[0],
      trucks: sortedFleet,
    };
  }).sort((a, b) => b.availableCount - a.availableCount || a.name.localeCompare(b.name));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function companySlug(value: string) {
  return slugify(value);
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
