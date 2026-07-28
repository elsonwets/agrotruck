import type { Truck } from "@/types/truck";

export interface TransportCompany {
  slug: string;
  name: string;
  headquarters: string;
  phone: string;
  whatsapp: string;
  verified: boolean;
  fleetSize: number;
  availableCount: number;
  totalCapacityTons: number;
  serviceAreas: string[];
  acceptedMaterials: string[];
  coverImage: string;
  trucks: Truck[];
}
