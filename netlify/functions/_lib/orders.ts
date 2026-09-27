import { randomUUID } from "node:crypto";
import { categoryOfTruckType, type VehicleCategory } from "../../../data/vehicle-categories";
import type { PublicAccount } from "../../../types/account";
import type { Order } from "../../../types/order";
import { orderStatus, type Actor, type TransitionResult } from "../../../lib/missions";

export {
  filterOrders, orderStatus, transition, type Actor, type OrderAction, type OrderFilters, type TransitionResult,
} from "../../../lib/missions";
import type { Truck } from "../../../types/truck";
import { jsonStore, type BlobStore } from "./accounts";

function defaultStore(): BlobStore {
  return jsonStore("agrotruck-orders");
}

export type OrderInput = Omit<Order, "id" | "createdAt" | "updatedAt" | "status" | "events" | "transporterAccountId">;

// `id` facultatif : une mission publiée hors ligne arrive avec l'identifiant choisi sur le téléphone.
export async function createOrder(input: OrderInput & { id?: string }, store: BlobStore = defaultStore()): Promise<Order> {
  const createdAt = new Date().toISOString();
  const order: Order = {
    ...input,
    id: input.id ?? randomUUID(),
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

export async function findOrderById(id: string, store: BlobStore = defaultStore()): Promise<Order | null> {
  return ((await store.get(`by-id/${id}`)) as Order | null) ?? null;
}

export async function saveOrder(order: Order, store: BlobStore = defaultStore()): Promise<void> {
  await store.setJSON(`by-id/${order.id}`, order);
}

export function canViewOrder(order: Order, actor: Actor): boolean {
  return actor.role === "admin"
    || (actor.role === "producer" && order.producerAccountId === actor.accountId)
    || (actor.role === "partner" && order.transporterAccountId === actor.accountId);
}

// Un transporteur ne voit le numéro du producteur qu'après avoir accepté la mission.
export function missionForViewer(order: Order, actor: Actor): Order {
  if (actor.role !== "partner" || order.transporterAccountId === actor.accountId) return order;
  const copy: Partial<Order> = { ...order };
  delete copy.clientPhone;
  return copy as Order;
}

// Lit la mission, applique le changement et n'écrit que si personne ne l'a modifiée entre-temps (ETag).
// En cas de course, on recommence une fois sur la version à jour : un 2e « accepter » reçoit alors « Mission déjà prise ».
export async function updateOrderIfUnchanged(
  id: string,
  change: (order: Order) => TransitionResult,
  store: BlobStore = defaultStore(),
): Promise<TransitionResult | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await store.getWithEtag(`by-id/${id}`);
    if (!current?.data) return null;
    const result = change(current.data as Order);
    if (!result.ok) return result;
    if (!current.etag) { await saveOrder(result.order, store); return result; }
    if (await store.setJSONIfMatch(`by-id/${id}`, result.order, current.etag)) return result;
  }
  return { ok: false, status: 409, error: "La mission vient d'être modifiée. Rechargez la page." };
}

export interface TransporterContact { name: string; phone: string }

// Le producteur voit le transporteur (ou son entreprise) et le numéro du transporteur, jamais celui de Badora.
export function transporterContact(transporter: PublicAccount | null): TransporterContact | null {
  return transporter ? { name: transporter.companyName || transporter.displayName, phone: transporter.phone } : null;
}

// Catégories d'un transporteur : celles de son profil + celles de ses camions publiés.
export function transporterCategories(account: PublicAccount, trucks: Truck[]): Set<VehicleCategory> {
  const categories = new Set(account.vehicleCategories ?? []);
  for (const truck of trucks) {
    if (truck.ownerAccountId !== account.id || truck.listingStatus !== "published") continue;
    const category = categoryOfTruckType(truck.type);
    if (category) categories.add(category);
  }
  return categories;
}

// Une mission n'est proposée qu'aux transporteurs du bon type de véhicule ET de la bonne région de chargement.
export function matchesTransporter(order: Order, account: PublicAccount, trucks: Truck[]): boolean {
  if (account.role !== "partner" || account.disabled || orderStatus(order) !== "pending") return false;
  // Les demandes anonymes de /location n'ont ni catégorie ni zone : Badora les traite à la main.
  if (!order.vehicleCategory || !order.pickupZone) return false;
  if (!account.workZones?.includes(order.pickupZone)) return false;
  const categories = transporterCategories(account, trucks);
  return order.vehicleCategory === "any" ? categories.size > 0 : categories.has(order.vehicleCategory);
}

