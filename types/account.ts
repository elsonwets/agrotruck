import type { VehicleCategory } from "../data/vehicle-categories";
import type { Zone } from "../data/zones";

export type AccountRole = "admin" | "partner" | "producer";

export interface Account {
  id: string;
  phone: string;
  passwordHash: string;
  role: AccountRole;
  displayName: string;
  createdAt: string;
  updatedAt?: string;
  disabled?: boolean;
  companyName?: string;
  // Transporteur (partner)
  vehicleCategories?: VehicleCategory[];
  vehicleCapacityTons?: number;
  workZones?: Zone[];
  // Producteur
  mainZone?: Zone;
  mainLocation?: string;
}

export type PublicAccount = Omit<Account, "passwordHash">;
