import { signSession, verifySession, type SessionPayload } from "./crypto";

export const SESSION_COOKIE_NAME = "agrotruck_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function sessionCookieHeader(payload: SessionPayload): string {
  const token = signSession(payload);
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getSessionFromRequest(request: Request): SessionPayload | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) return null;
  return verifySession(match.slice(SESSION_COOKIE_NAME.length + 1));
}
