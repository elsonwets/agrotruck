import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Role } from "../../src/shared/domain";
import { sha256 } from "./security";

// Les sessions sont des jetons aléatoires transmis en argument (motif « session token » de Convex) ;
// on ne stocke que leur empreinte. Les sessions expirées sont supprimées par un cron (pas d'horloge dans les requêtes).

export const SESSION_DAYS = 30;

export async function getSessionUser(ctx: QueryCtx | MutationCtx, token: string | undefined): Promise<Doc<"users"> | null> {
  if (!token) return null;
  const tokenHash = await sha256(token);
  const session = await ctx.db.query("sessions").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
  if (!session) return null;
  const user = await ctx.db.get("users", session.userId);
  return user && !user.disabled ? user : null;
}

export async function requireUser(ctx: QueryCtx | MutationCtx, token: string, roles?: Role[]): Promise<Doc<"users">> {
  const user = await getSessionUser(ctx, token);
  if (!user) throw new ConvexError({ code: "unauthenticated" });
  if (roles && !roles.includes(user.role)) throw new ConvexError({ code: "forbidden" });
  return user;
}

export function publicUser(user: Doc<"users">) {
  return {
    _id: user._id,
    phone: user.phone,
    role: user.role,
    displayName: user.displayName,
    companyName: user.companyName,
    disabled: user.disabled ?? false,
    lang: user.lang,
    vehicleCategories: user.vehicleCategories ?? [],
    capacityTons: user.capacityTons,
    workZones: user.workZones ?? [],
    mainZone: user.mainZone,
    mainLocation: user.mainLocation,
    createdAt: user._creationTime,
  };
}
