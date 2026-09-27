import type { MutationCtx } from "../_generated/server";

// Limite de tentatives. Les mutations Convex sont des transactions sérialisables : le compteur ne peut pas être
// contourné par des requêtes simultanées. Les appelants ne lèvent pas d'erreur après un échec, sinon la
// transaction serait annulée et la tentative ne serait pas comptée.

export interface AttemptLimit { max: number; windowMinutes: number; lockMinutes: number }

export const LOGIN_LIMIT: AttemptLimit = { max: 5, windowMinutes: 15, lockMinutes: 15 };
export const SIGNUP_LIMIT: AttemptLimit = { max: 60, windowMinutes: 10, lockMinutes: 10 }; // protection globale anti-robot

const MINUTE = 60_000;

async function find(ctx: MutationCtx, key: string) {
  return ctx.db.query("attempts").withIndex("by_key", (q) => q.eq("key", key)).unique();
}

export async function isLocked(ctx: MutationCtx, key: string, now: number): Promise<boolean> {
  const record = await find(ctx, key);
  return Boolean(record?.lockedUntil && record.lockedUntil > now);
}

export async function recordAttempt(ctx: MutationCtx, key: string, limit: AttemptLimit, now: number): Promise<void> {
  const record = await find(ctx, key);
  const fresh = !record || now - record.since > limit.windowMinutes * MINUTE;
  const count = (fresh ? 0 : record.count) + 1;
  const next = count >= limit.max
    ? { key, count: 0, since: now, lockedUntil: now + limit.lockMinutes * MINUTE }
    : { key, count, since: fresh ? now : record.since };
  if (record) await ctx.db.replace("attempts", record._id, next);
  else await ctx.db.insert("attempts", next);
}

export async function clearAttempts(ctx: MutationCtx, key: string): Promise<void> {
  const record = await find(ctx, key);
  if (record) await ctx.db.delete("attempts", record._id);
}
