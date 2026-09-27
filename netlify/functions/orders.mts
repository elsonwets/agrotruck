import { z } from "zod";
import { createOrder, listOrders } from "./_lib/orders";
import { getActiveSession } from "./_lib/session";

const orderInputSchema = z.object({
  requestedTruckCount: z.coerce.number().int().positive(),
  truckType: z.string().min(1),
  pickupLocation: z.string().min(1),
  dropoffLocation: z.string().min(1),
  neededFrom: z.string().min(1),
  cargoDescription: z.string().default(""),
  clientName: z.string().min(1),
  clientPhone: z.string().min(1),
});

const handler = async (request: Request) => {
  if (request.method === "GET") return handleList(request);
  if (request.method === "POST") return handleCreate(request);
  return json({ error: "Méthode non autorisée" }, 405);
};

export default handler;

async function handleList(request: Request) {
  if ((await getActiveSession(request))?.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
  return json(await listOrders());
}

async function handleCreate(request: Request) {
  const body = (await request.json().catch(() => null)) as { website?: string } | null;
  if (body?.website) return json({ error: "Requête invalide" }, 400); // honeypot
  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Champs invalides", issues: parsed.error.issues }, 400);
  return json(await createOrder(parsed.data), 201);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
