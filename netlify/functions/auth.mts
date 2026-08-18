import { createAccount, findAccountByPhone, findAccountById, listAccounts } from "./_lib/accounts";
import { verifyPassword } from "./_lib/crypto";
import { sessionCookieHeader, clearSessionCookieHeader, getSessionFromRequest } from "./_lib/session";

const handler = async (request: Request) => {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (request.method === "GET" && action === "session") return handleSession(request);
  if (request.method === "GET" && action === "list-partners") return handleListPartners(request);
  if (request.method === "POST" && action === "login") return handleLogin(request);
  if (request.method === "POST" && action === "logout") return handleLogout();
  if (request.method === "POST" && action === "create-partner") return handleCreatePartner(request);
  return json({ error: "Action invalide" }, 400);
};

export default handler;

async function handleSession(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session) return json({ error: "Non connecté" }, 401);
  const account = await findAccountById(session.accountId);
  if (!account) return json({ error: "Non connecté" }, 401);
  return json({ accountId: account.id, role: account.role, displayName: account.displayName });
}

async function handleLogin(request: Request) {
  const body = (await request.json().catch(() => null)) as { phone?: string; password?: string } | null;
  if (!body?.phone || !body.password) return json({ error: "Téléphone et mot de passe requis" }, 400);
  const account = await findAccountByPhone(body.phone);
  if (!account || !(await verifyPassword(body.password, account.passwordHash))) return json({ error: "Identifiants invalides" }, 401);
  return json(
    { role: account.role, displayName: account.displayName },
    200,
    { "Set-Cookie": sessionCookieHeader({ accountId: account.id, role: account.role, displayName: account.displayName }) },
  );
}

function handleLogout() {
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookieHeader() });
}

async function handleCreatePartner(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
  const body = (await request.json().catch(() => null)) as { phone?: string; displayName?: string; password?: string } | null;
  if (!body?.phone || !body.displayName || !body.password) return json({ error: "Champs manquants" }, 400);
  if (await findAccountByPhone(body.phone)) return json({ error: "Ce numéro a déjà un compte" }, 409);
  const account = await createAccount({ phone: body.phone, displayName: body.displayName, password: body.password, role: "partner" });
  return json({ id: account.id, phone: account.phone, displayName: account.displayName, role: account.role }, 201);
}

async function handleListPartners(request: Request) {
  const session = getSessionFromRequest(request);
  if (!session || session.role !== "admin") return json({ error: "Réservé à Badora" }, 403);
  return json(await listAccounts("partner"));
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
}
