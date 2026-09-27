import { v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { normalizePhone, PIN_PATTERN } from "../src/shared/domain";
import { clearAttempts, isLocked, LOGIN_LIMIT, recordAttempt, SIGNUP_LIMIT } from "./lib/attempts";
import { hashPassword, newSessionToken, sha256, verifyPassword } from "./lib/security";
import { getSessionUser, SESSION_DAYS } from "./lib/session";
import { vCategory, vLang, vZone } from "./lib/validators";

// Connexion par téléphone + PIN. Les échecs sont renvoyés comme résultats (pas comme erreurs) :
// une erreur annulerait la transaction et la tentative ratée ne serait pas comptée.

type AuthResult =
  | { ok: true; token: string; role: "admin" | "transporter" | "producer"; displayName: string }
  | { ok: false; error: "invalid_phone" | "invalid_pin" | "phone_taken" | "invalid_credentials" | "locked" | "disabled" | "rate_limited" };

const DAY = 24 * 60 * 60 * 1000;
const validPhone = (phone: string) => /^\+?[\d\s-]{7,20}$/.test(phone.trim());

async function openSession(ctx: MutationCtx, userId: Id<"users">, now: number): Promise<string> {
  const token = newSessionToken();
  await ctx.db.insert("sessions", { userId, tokenHash: await sha256(token), expiresAt: now + SESSION_DAYS * DAY });
  return token;
}

async function phoneTaken(ctx: MutationCtx, phone: string) {
  return ctx.db.query("users").withIndex("by_phoneKey", (q) => q.eq("phoneKey", normalizePhone(phone))).unique();
}

export const signup = mutation({
  args: {
    role: v.union(v.literal("producer"), v.literal("transporter")),
    phone: v.string(),
    pin: v.string(),
    displayName: v.optional(v.string()),
    companyName: v.optional(v.string()),
    lang: v.optional(vLang),
    mainZone: v.optional(vZone),
    mainLocation: v.optional(v.string()),
    vehicleCategories: v.optional(v.array(vCategory)),
    workZones: v.optional(v.array(vZone)),
  },
  handler: async (ctx, args): Promise<AuthResult> => {
    const now = Date.now();
    if (await isLocked(ctx, "signup", now)) return { ok: false, error: "rate_limited" };
    if (!validPhone(args.phone)) return { ok: false, error: "invalid_phone" };
    if (!PIN_PATTERN.test(args.pin)) return { ok: false, error: "invalid_pin" };
    if (await phoneTaken(ctx, args.phone)) return { ok: false, error: "phone_taken" };
    await recordAttempt(ctx, "signup", SIGNUP_LIMIT, now);
    const phone = args.phone.trim();
    const displayName = args.displayName?.trim().slice(0, 80) || phone;
    const userId = await ctx.db.insert("users", {
      phone,
      phoneKey: normalizePhone(phone),
      passwordHash: await hashPassword(args.pin),
      role: args.role,
      displayName,
      companyName: args.companyName?.trim().slice(0, 80) || undefined,
      lang: args.lang,
      ...(args.role === "producer"
        ? { mainZone: args.mainZone, mainLocation: args.mainLocation?.trim().slice(0, 120) || undefined }
        : { vehicleCategories: args.vehicleCategories ?? [], workZones: args.workZones ?? [] }),
    });
    return { ok: true, token: await openSession(ctx, userId, now), role: args.role, displayName };
  },
});

export const login = mutation({
  args: { phone: v.string(), pin: v.string() },
  handler: async (ctx, args): Promise<AuthResult> => {
    const now = Date.now();
    const key = `login:${normalizePhone(args.phone)}`;
    if (await isLocked(ctx, key, now)) return { ok: false, error: "locked" };
    const user = await phoneTaken(ctx, args.phone);
    if (!user || !(await verifyPassword(args.pin, user.passwordHash))) {
      await recordAttempt(ctx, key, LOGIN_LIMIT, now);
      return { ok: false, error: "invalid_credentials" };
    }
    await clearAttempts(ctx, key);
    if (user.disabled) return { ok: false, error: "disabled" };
    return { ok: true, token: await openSession(ctx, user._id, now), role: user.role, displayName: user.displayName };
  },
});

export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = await sha256(token);
    const session = await ctx.db.query("sessions").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
    if (session) await ctx.db.delete("sessions", session._id);
    return null;
  },
});

// Session courante (null si absente, expirée ou compte bloqué).
export const session = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const user = await getSessionUser(ctx, token);
    return user ? { userId: user._id, role: user.role, displayName: user.displayName } : null;
  },
});

// Nettoyage périodique (cron) : sessions expirées et compteurs de tentatives anciens.
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db.query("sessions").withIndex("by_expiresAt", (q) => q.lt("expiresAt", now)).take(200);
    for (const session of expired) await ctx.db.delete("sessions", session._id);
    const stale = await ctx.db.query("attempts").take(200);
    for (const attempt of stale) {
      if ((attempt.lockedUntil ?? attempt.since) < now - DAY) await ctx.db.delete("attempts", attempt._id);
    }
    if (expired.length === 200) await ctx.scheduler.runAfter(0, internal.auth.purgeExpired, {});
    return null;
  },
});
