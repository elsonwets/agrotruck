import { randomUUID } from "node:crypto";
import { categoryOfTruckType, type VehicleCategory } from "../../../data/vehicle-categories";
import type { Zone } from "../../../data/zones";
import type { Account, AccountRole } from "../../../types/account";
import type { Order, OrderEventType, OrderStatus, ProductType } from "../../../types/order";
import type { Truck } from "../../../types/truck";
import { jsonStore, type BlobStore } from "./accounts";

function defaultStore(): BlobStore {
  return jsonStore("agrotruck-orders");
}

export type OrderInput = Omit<Order, "id" | "createdAt" | "updatedAt" | "status" | "events" | "transporterAccountId">;

export async function createOrder(input: OrderInput, store: BlobStore = defaultStore()): Promise<Order> {
  const createdAt = new Date().toISOString();
  const order: Order = {
    ...input,
    id: randomUUID(),
    createdAt,
    status: "pending",
    events: [{ type: "created", accountId: input.producerAccountId, at: createdAt }],
  };
  await store.setJSON(`by-id/${order.id}`, order);
  return order;
}

export async function listOrders(store: BlobStore = defaultStore()): Promise<Order[]> {
  const { blobs } = await store.list({ prefix: "by-id/" });
  const orders = await Promise.all(blobs.map(({ key }) => store.get(key) as Promise<Order>));
  return orders
    .filter((order): order is Order => Boolean(order))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function orderStatus(order: Order): OrderStatus {
  return order.status ?? "pending";
}

// Catégories d'un transporteur : celles de son profil + celles de ses camions publiés.
export function transporterCategories(account: Account, trucks: Truck[]): Set<VehicleCategory> {
  const categories = new Set(account.vehicleCategories ?? []);
  for (const truck of trucks) {
    if (truck.ownerAccountId !== account.id || truck.listingStatus !== "published") continue;
    const category = categoryOfTruckType(truck.type);
    if (category) categories.add(category);
  }
  return categories;
}

// Une mission n'est proposée qu'aux transporteurs du bon type de véhicule ET de la bonne région de chargement.
export function matchesTransporter(order: Order, account: Account, trucks: Truck[]): boolean {
  if (account.role !== "partner" || account.disabled || orderStatus(order) !== "pending") return false;
  // Les demandes anonymes de /location n'ont ni catégorie ni zone : Badora les traite à la main.
  if (!order.vehicleCategory || !order.pickupZone) return false;
  if (!account.workZones?.includes(order.pickupZone)) return false;
  const categories = transporterCategories(account, trucks);
  return order.vehicleCategory === "any" ? categories.size > 0 : categories.has(order.vehicleCategory);
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
