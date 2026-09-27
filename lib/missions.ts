import { vehicleCategoryLabels } from "../data/vehicle-categories";
import { zoneLabels, type Zone } from "../data/zones";
import type { AccountRole } from "../types/account";
import { orderStatusLabels, productTypeLabels, type Order, type OrderEventType, type OrderStatus, type ProductType } from "../types/order";

// Règles et formats partagés entre le navigateur et les Netlify Functions.

export function orderStatus(order: Order): OrderStatus {
  return order.status ?? "pending";
}

export function missionRoute(order: Order): string {
  const place = (location: string, zone?: Zone) => (zone ? `${location} (${zoneLabels[zone]})` : location);
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

export interface OrderFilters {
  from?: string; // YYYY-MM-DD, inclus
  to?: string; // YYYY-MM-DD, inclus
  status?: OrderStatus;
  productType?: ProductType;
  pickupZone?: Zone;
  dropoffZone?: Zone;
}

export function filterOrders(orders: Order[], filters: OrderFilters): Order[] {
  return orders.filter((order) => {
    const day = order.createdAt.slice(0, 10);
    return (!filters.from || day >= filters.from)
      && (!filters.to || day <= filters.to)
      && (!filters.status || orderStatus(order) === filters.status)
      && (!filters.productType || order.productType === filters.productType)
      && (!filters.pickupZone || order.pickupZone === filters.pickupZone)
      && (!filters.dropoffZone || order.dropoffZone === filters.dropoffZone);
  });
}

export interface MissionStats {
  missions: number;
  delivered: number;
  tonnes: number;
  activeTransporters: number;
  topRoutes: { route: string; count: number }[];
}

// Indicateurs d'un mois (YYYY-MM) : missions suivies non annulées ; les demandes anonymes /location sont exclues.
export function missionStats(orders: Order[], month: string): MissionStats {
  const missions = orders.filter((order) => order.pickupZone && order.createdAt.startsWith(month) && orderStatus(order) !== "cancelled");
  const delivered = missions.filter((order) => orderStatus(order) === "delivered");
  const routes = new Map<string, number>();
  for (const order of missions) {
    if (!order.pickupZone || !order.dropoffZone) continue;
    const route = `${zoneLabels[order.pickupZone]} → ${zoneLabels[order.dropoffZone]}`;
    routes.set(route, (routes.get(route) ?? 0) + 1);
  }
  return {
    missions: missions.length,
    delivered: delivered.length,
    tonnes: Number((delivered.reduce((total, order) => total + (order.quantityKg ?? 0), 0) / 1000).toFixed(1)),
    activeTransporters: new Set(missions.map((order) => order.transporterAccountId).filter(Boolean)).size,
    topRoutes: [...routes].map(([route, count]) => ({ route, count })).sort((a, b) => b.count - a.count).slice(0, 5),
  };
}

// Export CSV pour les rapports (bailleurs, projets) : « ; » et BOM UTF-8 pour Excel en français.
export function ordersToCsv(orders: Order[], transporterNames: Record<string, string> = {}): string {
  const header = [
    "Créée le", "Statut", "Produit", "Sacs", "Kg", "Région départ", "Lieu départ", "Région arrivée", "Lieu arrivée",
    "Date souhaitée", "Véhicule", "Producteur", "Téléphone producteur", "Transporteur", "Commentaire",
  ];
  const cell = (value: unknown) => {
    const text = value === undefined || value === null ? "" : String(value);
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = orders.map((order) => [
    order.createdAt.slice(0, 10),
    orderStatusLabels[orderStatus(order)],
    order.productType ? productTypeLabels[order.productType] : "",
    order.quantitySacks, order.quantityKg,
    order.pickupZone ? zoneLabels[order.pickupZone] : "", order.pickupLocation,
    order.dropoffZone ? zoneLabels[order.dropoffZone] : "", order.dropoffLocation,
    order.neededFrom,
    order.vehicleCategory === "any" ? "Peu importe" : order.vehicleCategory ? vehicleCategoryLabels[order.vehicleCategory] : order.truckType,
    order.clientName, order.clientPhone,
    order.transporterAccountId ? transporterNames[order.transporterAccountId] ?? order.transporterAccountId : "",
    order.cargoDescription,
  ].map(cell).join(";"));
  return `﻿${[header.join(";"), ...rows].join("\r\n")}\r\n`;
}

export type OrderAction = "accept" | "assign" | "loaded" | "delivered" | "cancel";
export interface Actor { accountId: string; role: AccountRole }
export type TransitionResult = { ok: true; order: Order } | { ok: false; status: 400 | 403 | 409; error: string };

// Machine à états des missions. Le contrôle type + zone de « accept » est fait par l'appelant (matchesTransporter).
export function transition(
  order: Order,
  action: OrderAction,
  actor: Actor,
  options: { at?: string; transporterAccountId?: string; comment?: string } = {},
): TransitionResult {
  const status = orderStatus(order);
  const at = options.at ?? new Date().toISOString();
  const isAdmin = actor.role === "admin";
  const isAssignedTransporter = actor.role === "partner" && order.transporterAccountId === actor.accountId;
  const isOwner = actor.role === "producer" && order.producerAccountId === actor.accountId;
  const fail = (code: 400 | 403 | 409, error: string): TransitionResult => ({ ok: false, status: code, error });
  const forbidden = fail(403, "Action non autorisée");
  const apply = (next: OrderStatus, type: OrderEventType, patch: Partial<Order> = {}): TransitionResult => ({
    ok: true,
    order: {
      ...order,
      ...patch,
      status: next,
      updatedAt: at,
      events: [...(order.events ?? []), { type, accountId: actor.accountId, at, ...(options.comment ? { comment: options.comment } : {}) }],
    },
  });

  switch (action) {
    case "accept":
      if (actor.role !== "partner") return forbidden;
      if (status !== "pending") return fail(409, "Mission déjà prise");
      return apply("assigned", "assigned", { transporterAccountId: actor.accountId });
    case "assign":
      if (!isAdmin) return forbidden;
      if (!options.transporterAccountId) return fail(400, "Transporteur requis");
      if (status !== "pending" && status !== "assigned") return fail(409, "Mission déjà en cours");
      return apply("assigned", "assigned", { transporterAccountId: options.transporterAccountId });
    case "loaded":
      if (!isAssignedTransporter && !isOwner && !isAdmin) return forbidden;
      if (status !== "assigned") return fail(409, "La mission n'est pas à charger");
      return apply("loaded", "loaded");
    case "delivered":
      if (!isAssignedTransporter && !isOwner && !isAdmin) return forbidden;
      if (status === "delivered") {
        // Double validation : l'autre partie peut confirmer la livraison une fois.
        const alreadyConfirmed = order.events?.some((event) => event.type === "delivered" && event.accountId === actor.accountId);
        return alreadyConfirmed ? fail(409, "Livraison déjà confirmée") : apply("delivered", "delivered");
      }
      if (status !== "loaded") return fail(409, "La mission n'est pas en route");
      return apply("delivered", "delivered");
    case "cancel":
      if (!isOwner && !isAdmin) return forbidden;
      if (status !== "pending" && status !== "assigned") return fail(409, "La mission ne peut plus être annulée");
      return apply("cancelled", "cancelled");
  }
}
