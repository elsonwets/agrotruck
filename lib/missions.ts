import { zoneLabels } from "../data/zones";
import type { Order } from "../types/order";

export function missionRoute(order: Order): string {
  const place = (location: string, zone?: Order["pickupZone"]) => (zone ? `${location} (${zoneLabels[zone]})` : location);
  return `${place(order.pickupLocation, order.pickupZone)} → ${place(order.dropoffLocation, order.dropoffZone)}`;
}

export function missionQuantity(order: Order): string {
  const parts: string[] = [];
  if (order.quantitySacks) parts.push(`${order.quantitySacks} sac${order.quantitySacks > 1 ? "s" : ""}`);
  if (order.quantityKg) parts.push(order.quantityKg >= 1000 ? `${Number((order.quantityKg / 1000).toFixed(1))} t` : `${order.quantityKg} kg`);
  return parts.join(" · ");
}

export function isFinished(order: Order): boolean {
  return order.status === "delivered" || order.status === "cancelled";
}

// "2026-10-05" → "05/10/2026"
export function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00`);
  return Number.isNaN(date.getTime()) ? day : date.toLocaleDateString("fr-FR");
}
