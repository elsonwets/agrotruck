import { z } from "zod";
import { findAccountById, listAccounts } from "./_lib/accounts";
import {
  canViewOrder, createOrder, findOrderById, listOrders, matchesTransporter, missionForViewer, transition, transporterContact,
  updateOrderIfUnchanged, type OrderAction,
} from "./_lib/orders";
import { listAllTrucks } from "./_lib/trucks";
import { categorySchema, zoneSchema } from "./_lib/schemas";
import { getActiveSession } from "./_lib/session";
import type { SessionPayload } from "./_lib/crypto";
import type { Order } from "../../types/order";

// Demande anonyme du formulaire /location (transmise à WhatsApp, traitée à la main par Badora).
const anonymousSchema = z.object({
  requestedTruckCount: z.coerce.number().int().positive(),
  truckType: z.string().min(1),
  pickupLocation: z.string().min(1),
  dropoffLocation: z.string().min(1),
  neededFrom: z.string().min(1),
  cargoDescription: z.string().default(""),
  clientName: z.string().min(1),
  clientPhone: z.string().min(1),
});

// Mission publiée par un producteur connecté.
const missionSchema = z.object({
  vehicleCategory: z.union([categorySchema, z.literal("any")]),
  pickupZone: zoneSchema,
  pickupLocation: z.string().trim().min(1).max(200),
  dropoffZone: zoneSchema,
  dropoffLocation: z.string().trim().min(1).max(200),
  productType: z.enum(["cashew", "rice", "other"]),
  quantitySacks: z.coerce.number().int().nonnegative().optional(),
  quantityKg: z.coerce.number().nonnegative().optional(),
  neededFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cargoDescription: z.string().trim().max(500).default(""),
  // Identifiant choisi par le téléphone : rejouer une demande publiée hors ligne ne crée pas de doublon.
  clientRequestId: z.string().uuid().optional(),
}).refine((mission) => Boolean(mission.quantitySacks || mission.quantityKg), { message: "Quantité requise", path: ["quantitySacks"] });

const actions = new Set<OrderAction>(["accept", "assign", "loaded", "delivered", "cancel"]);

const handler = async (request: Request) => {
  const url = new URL(request.url);
  if (request.method === "GET" && url.searchParams.get("id")) return handleGetOne(request, url.searchParams.get("id")!);
  if (request.method === "GET" && url.searchParams.get("scope") === "mine") return handleMine(request);
  if (request.method === "GET" && url.searchParams.get("scope") === "available") return handleAvailable(request);
  if (request.method === "GET" && url.searchParams.get("scope") === "assigned") return handleAssigned(request);
  if (request.method === "GET") return handleList(request);
  if (request.method === "POST" && url.searchParams.get("id")) return handleAction(request, url);
  if (request.method === "POST") return handleCreate(request);
  return json({ error: "Méthode non autorisée" }, 405);
};

export default handler;

// Vue Badora : chaque mission avec son transporteur et, si elle attend, les transporteurs qui correspondent.
async function handleList(request: Request) {
  if ((await getActiveSession(request))?.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
  const [orders, partners, trucks] = await Promise.all([listOrders(), listAccounts("partner"), listAllTrucks()]);
  const byId = new Map(partners.map((partner) => [partner.id, partner]));
  return json(orders.map((order) => ({
    ...order,
    transporter: transporterContact((order.transporterAccountId && byId.get(order.transporterAccountId)) || null),
    ...(order.pickupZone && (order.status ?? "pending") === "pending" && {
      candidateIds: partners.filter((partner) => matchesTransporter(order, partner, trucks)).map((partner) => partner.id),
    }),
  })));
}

async function handleMine(request: Request) {
  const session = await getActiveSession(request);
  if (session?.role !== "producer") return json({ error: "Réservé aux producteurs" }, 403);
  return json((await listOrders()).filter((order) => order.producerAccountId === session.accountId));
}

// Missions proposées au transporteur : bon type de véhicule ET bonne région de chargement.
async function handleAvailable(request: Request) {
  const session = await getActiveSession(request);
  if (session?.role !== "partner") return json({ error: "Réservé aux transporteurs" }, 403);
  const [account, trucks, orders] = await Promise.all([findAccountById(session.accountId), listAllTrucks(), listOrders()]);
  if (!account) return json({ error: "Non connecté" }, 401);
  return json(orders.filter((order) => matchesTransporter(order, account, trucks)).map((order) => missionForViewer(order, session)));
}

async function handleAssigned(request: Request) {
  const session = await getActiveSession(request);
  if (session?.role !== "partner") return json({ error: "Réservé aux transporteurs" }, 403);
  return json((await listOrders()).filter((order) => order.transporterAccountId === session.accountId));
}

async function handleGetOne(request: Request, id: string) {
  const session = await getActiveSession(request);
  if (!session) return json({ error: "Non connecté" }, 401);
  const order = await findOrderById(id);
  if (!order || !(canViewOrder(order, session) || (await offeredTo(order, session)))) return json({ error: "Mission introuvable" }, 404);
  return json(await withTransporter(missionForViewer(order, session)));
}

// Une mission encore disponible est visible par les transporteurs à qui elle est proposée.
async function offeredTo(order: Order, session: SessionPayload) {
  if (session.role !== "partner") return false;
  const [account, trucks] = await Promise.all([findAccountById(session.accountId), listAllTrucks()]);
  return Boolean(account && matchesTransporter(order, account, trucks));
}

async function handleCreate(request: Request) {
  const body = (await request.json().catch(() => null)) as { website?: string } | null;
  if (body?.website) return json({ error: "Requête invalide" }, 400); // honeypot
  const session = await getActiveSession(request);
  if (session?.role === "producer") return createMission(session, body);
  const parsed = anonymousSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Champs invalides", issues: parsed.error.issues }, 400);
  return json(await createOrder(parsed.data), 201);
}

async function createMission(session: SessionPayload, body: unknown) {
  const parsed = missionSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Champs invalides", issues: parsed.error.issues }, 400);
  const producer = await findAccountById(session.accountId);
  if (!producer) return json({ error: "Non connecté" }, 401);
  const { clientRequestId, ...mission } = parsed.data;
  if (clientRequestId) {
    const existing = await findOrderById(clientRequestId);
    if (existing) return existing.producerAccountId === producer.id ? json(existing) : json({ error: "Requête invalide" }, 409);
  }
  const order = await createOrder({
    ...mission,
    id: clientRequestId,
    producerAccountId: producer.id,
    requestedTruckCount: 1,
    truckType: "",
    clientName: producer.companyName || producer.displayName,
    clientPhone: producer.phone,
  });
  return json(order, 201);
}

async function handleAction(request: Request, url: URL) {
  const session = await getActiveSession(request);
  if (!session) return json({ error: "Non connecté" }, 401);
  const action = url.searchParams.get("action") as OrderAction;
  if (!actions.has(action)) return json({ error: "Action invalide" }, 400);
  const id = url.searchParams.get("id")!;
  const order = await findOrderById(id);
  if (!order) return json({ error: "Mission introuvable" }, 404);
  if (action === "accept") {
    if (!(await offeredTo(order, session))) {
      return order.status && order.status !== "pending" ? json({ error: "Mission déjà prise" }, 409) : json({ error: "Mission introuvable" }, 404);
    }
  } else if (!canViewOrder(order, session)) {
    return json({ error: "Mission introuvable" }, 404);
  }
  if (action === "assign") {
    const transporterId = ((await request.clone().json().catch(() => null)) as { transporterAccountId?: string } | null)?.transporterAccountId;
    const transporter = transporterId ? await findAccountById(transporterId) : null;
    if (!transporter || transporter.role !== "partner" || transporter.disabled) return json({ error: "Transporteur actif requis" }, 400);
  }
  const body = (await request.json().catch(() => null)) as { at?: string; comment?: string; transporterAccountId?: string } | null;
  const options = {
    at: validPastDate(body?.at),
    comment: typeof body?.comment === "string" ? body.comment.slice(0, 300) : undefined,
    transporterAccountId: typeof body?.transporterAccountId === "string" ? body.transporterAccountId : undefined,
  };
  const result = await updateOrderIfUnchanged(id, (current) => transition(current, action, session, options));
  if (!result) return json({ error: "Mission introuvable" }, 404);
  if (!result.ok) return json({ error: result.error }, result.status);
  return json(await withTransporter(missionForViewer(result.order, session)));
}

// Heure saisie (ex. action faite hors ligne) : acceptée si elle est valide et pas dans le futur.
function validPastDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const time = Date.parse(value);
  return Number.isNaN(time) || time > Date.now() + 60_000 ? undefined : new Date(time).toISOString();
}

async function withTransporter<T extends { transporterAccountId?: string }>(order: T) {
  const transporter = order.transporterAccountId ? await findAccountById(order.transporterAccountId) : null;
  return { ...order, transporter: transporterContact(transporter) };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
