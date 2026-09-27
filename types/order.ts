import type { VehicleCategory } from "../data/vehicle-categories";
import type { Zone } from "../data/zones";

export type OrderStatus = "pending" | "assigned" | "loaded" | "delivered" | "cancelled";
export type OrderEventType = "created" | "assigned" | "loaded" | "delivered" | "cancelled";
export type ProductType = "cashew" | "rice" | "other";

export interface OrderEvent {
  type: OrderEventType;
  accountId?: string;
  at: string;
  comment?: string;
}

export interface Order {
  id: string;
  requestedTruckCount: number;
  truckType: string;
  pickupLocation: string;
  dropoffLocation: string;
  neededFrom: string;
  cargoDescription: string;
  clientName: string;
  clientPhone: string;
  createdAt: string;
  // Missions suivies (absents sur les demandes anonymes de /location)
  producerAccountId?: string;
  transporterAccountId?: string;
  vehicleCategory?: VehicleCategory | "any";
  pickupZone?: Zone;
  dropoffZone?: Zone;
  productType?: ProductType;
  quantitySacks?: number;
  quantityKg?: number;
  status?: OrderStatus; // absent = "pending"
  events?: OrderEvent[];
  updatedAt?: string;
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "En attente", assigned: "Transporteur assigné", loaded: "Chargé – en route", delivered: "Livré", cancelled: "Annulé",
};

export const productTypeLabels: Record<ProductType, string> = { cashew: "Noix de cajou", rice: "Riz", other: "Autre" };

// Mission telle que renvoyée par la fonction orders : avec le contact du transporteur une fois assigné.
export interface MissionView extends Order {
  transporter?: { name: string; phone: string } | null;
  // Vue Badora : transporteurs à qui une mission en attente est proposée (type + région).
  candidateIds?: string[];
}
