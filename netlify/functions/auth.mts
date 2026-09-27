import { z } from "zod";
import {
  createAccount, findAccountByPhone, findAccountById, listAccounts, setAccountDisabled, setAccountPassword, toPublicAccount, updateProfile,
} from "./_lib/accounts";
import { verifyPassword } from "./_lib/crypto";
import { clearAttempts, isLocked, recordAttempt } from "./_lib/rate-limit";
import { sessionCookieHeader, clearSessionCookieHeader, getActiveSession } from "./_lib/session";
import { categorySchema, optionalText, phoneSchema, pinSchema, zoneSchema } from "./_lib/schemas";
import type { Account } from "../../types/account";

const LOGIN_LIMIT = { max: 5, windowMinutes: 15, lockMinutes: 15 };
// Large : beaucoup d'abonnés mobiles partagent la même IP publique.
const SIGNUP_LIMIT = { max: 20, windowMinutes: 60, lockMinutes: 60 };

const signupSchema = z.object({
  phone: phoneSchema,
  pin: pinSchema,
  displayName: optionalText(80),
  mainZone: zoneSchema.optional(),
  mainLocation: optionalText(120),
});

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  phone: phoneSchema.optional(),
  companyName: optionalText(80),
  vehicleCategories: z.array(categorySchema).optional(),
  vehicleCapacityTons: z.coerce.number().nonnegative().optional(),
  workZones: z.array(zoneSchema).optional(),
  mainZone: zoneSchema.optional(),
  mainLocation: optionalText(120),
});

type Context = { ip?: string };

const handler = async (request: Request, context?: Context) => {
  const action = new URL(request.url).searchParams.get("action");

  if (request.method === "GET" && action === "session") return handleSession(request);
  if (request.method === "GET" && action === "profile") return handleProfile(request);
  if (request.method === "GET" && action === "list-users") return handleListUsers(request);
  if (request.method === "POST" && action === "login") return handleLogin(request);
  if (request.method === "POST" && action === "logout") return handleLogout();
  if (request.method === "POST" && action === "signup") return handleSignup(request, context?.ip ?? request.headers.get("x-nf-client-connection-ip") ?? "unknown");
  if (request.method === "POST" && action === "update-profile") return handleUpdateProfile(request);
  if (request.method === "POST" && action === "create-partner") return handleCreatePartner(request);
  if (request.method === "POST" && action === "set-disabled") return handleSetDisabled(request);
  if (request.method === "POST" && action === "reset-password") return handleResetPassword(request);
  return json({ error: "Action invalide" }, 400);
};

export default handler;

async function handleSession(request: Request) {
  const session = await getActiveSession(request);
  return session ? json(session) : json({ error: "Non connecté" }, 401);
}

async function handleProfile(request: Request) {
  const session = await getActiveSession(request);
  if (!session) return json({ error: "Non connecté" }, 401);
  const account = await findAccountById(session.accountId);
  return account ? json(toPublicAccount(account)) : json({ error: "Non connecté" }, 401);
}

async function handleLogin(request: Request) {
  const body = (await request.json().catch(() => null)) as { phone?: string; password?: string } | null;
  if (!body?.phone || !body.password) return json({ error: "Téléphone et PIN requis" }, 400);
  const limitKey = `login/${body.phone.replace(/\D/g, "")}`;
  if (await isLocked(limitKey)) return json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, 429);
  const account = await findAccountByPhone(body.phone);
  if (!account || !(await verifyPassword(body.password, account.passwordHash))) {
    await recordAttempt(limitKey, LOGIN_LIMIT);
    return json({ error: "Identifiants invalides" }, 401);
  }
  await clearAttempts(limitKey);
  if (account.disabled) return json({ error: "Compte bloqué. Contactez Badora." }, 403);
  return withSession(account, { role: account.role, displayName: account.displayName });
}

function handleLogout() {
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookieHeader() });
}

async function handleSignup(request: Request, ip: string) {
  const limitKey = `signup-ip/${ip}`;
  if (await isLocked(limitKey)) return json({ error: "Trop d'inscriptions depuis ce réseau. Réessayez plus tard." }, 429);
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Champs invalides", issues: parsed.error.issues }, 400);
  const { phone, pin, displayName, mainZone, mainLocation } = parsed.data;
  if (await findAccountByPhone(phone)) return json({ error: "Ce numéro a déjà un compte" }, 409);
  await recordAttempt(limitKey, SIGNUP_LIMIT);
  const created = await createAccount({ phone, displayName: displayName || phone, password: pin, role: "producer" });
  const result = await updateProfile(created.id, { mainZone, mainLocation });
  const account = result.ok ? result.account : created;
  return withSession(account, { role: account.role, displayName: account.displayName }, 201);
}

async function handleUpdateProfile(request: Request) {
  const session = await getActiveSession(request);
  if (!session) return json({ error: "Non connecté" }, 401);
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Champs invalides", issues: parsed.error.issues }, 400);
  const result = await updateProfile(session.accountId, parsed.data);
  if (!result.ok) return json({ error: result.error }, result.status);
  // Le nom affiché vit aussi dans le cookie : on le réémet.
  return withSession(result.account, toPublicAccount(result.account));
}

async function handleCreatePartner(request: Request) {
  if (!(await isAdmin(request))) return json({ error: "Réservé à Badora" }, 403);
  const body = (await request.json().catch(() => null)) as { phone?: string; displayName?: string; password?: string } | null;
  if (!body?.phone || !body.displayName || !body.password) return json({ error: "Champs manquants" }, 400);
  if (await findAccountByPhone(body.phone)) return json({ error: "Ce numéro a déjà un compte" }, 409);
  const account = await createAccount({ phone: body.phone, displayName: body.displayName, password: body.password, role: "partner" });
  return json(toPublicAccount(account), 201);
}

async function handleListUsers(request: Request) {
  if (!(await isAdmin(request))) return json({ error: "Réservé à Badora" }, 403);
  const role = new URL(request.url).searchParams.get("role");
  return json(await listAccounts(role === "partner" || role === "producer" || role === "admin" ? role : undefined));
}

async function handleSetDisabled(request: Request) {
  const session = await getActiveSession(request);
  if (session?.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
  const body = (await request.json().catch(() => null)) as { accountId?: string; disabled?: boolean } | null;
  if (!body?.accountId || typeof body.disabled !== "boolean") return json({ error: "Champs manquants" }, 400);
  if (body.accountId === session.accountId) return json({ error: "Impossible de bloquer votre propre compte" }, 400);
  const account = await setAccountDisabled(body.accountId, body.disabled);
  return account ? json(toPublicAccount(account)) : json({ error: "Compte introuvable" }, 404);
}

async function handleResetPassword(request: Request) {
  if (!(await isAdmin(request))) return json({ error: "Réservé à Badora" }, 403);
  const body = (await request.json().catch(() => null)) as { accountId?: string; password?: string } | null;
  if (!body?.accountId || !body.password || body.password.length < 4) return json({ error: "PIN ou mot de passe de 4 caractères minimum" }, 400);
  const account = await setAccountPassword(body.accountId, body.password);
  return account ? json({ ok: true }) : json({ error: "Compte introuvable" }, 404);
}

async function isAdmin(request: Request) {
  return (await getActiveSession(request))?.role === "admin";
}

function withSession(account: Account, body: unknown, status = 200) {
  return json(body, status, { "Set-Cookie": sessionCookieHeader({ accountId: account.id, role: account.role, displayName: account.displayName }) });
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
