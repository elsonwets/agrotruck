export type TruckAvailability = "available" | "in_transit" | "occupied" | "maintenance";

export type TruckType = "flatbed" | "dump_truck" | "cargo" | "container" | "trailer" | "canter";

export interface Truck {
  id: string;
  slug: string;
  name: string;
  brand: string;
  model: string;
  type: TruckType;
  capacityTons: number;
  location: string;
  serviceAreas: string[];
  acceptedMaterials: string[];
  availability: TruckAvailability;
  availableFrom?: string;
  ownerName: string;
  companyName?: string;
  ownerType: "individual" | "company";
  phone: string;
  whatsapp: string;
  description: string;
  images: string[];
  verified: boolean;
  restrictions: string[];
}

export const truckTypeLabels: Record<TruckType, string> = {
  flatbed: "Plataforma",
  dump_truck: "Basculante",
  cargo: "Carga fechada",
  container: "Porta-contentor",
  trailer: "Semi-reboque",
  canter: "Canter",
};

export const availabilityLabels: Record<TruckAvailability, string> = {
  available: "Disponível",
  in_transit: "Em trânsito",
  occupied: "Ocupado",
  maintenance: "Manutenção",
};
