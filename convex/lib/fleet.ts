import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { FLEET_MIN_TRUCKS } from "../../src/shared/fleet";
import { requireUser } from "./session";

// Aides partagées par drivers.ts, tracking.ts, fleet.ts et trucks.ts.

// « Transporteur Pro » : au moins 2 véhicules. Calculé à chaque fois, rien n'est stocké.
export async function isFleetOwner(ctx: QueryCtx, userId: Id<"users">): Promise<boolean> {
  const trucks = await ctx.db.query("trucks").withIndex("by_ownerId", (q) => q.eq("ownerId", userId)).take(FLEET_MIN_TRUCKS);
  return trucks.length >= FLEET_MIN_TRUCKS;
}

export async function requireFleetOwner(ctx: QueryCtx | MutationCtx, token: string): Promise<Doc<"users">> {
  const user = await requireUser(ctx, token, ["transporter"]);
  if (!(await isFleetOwner(ctx, user._id))) throw new ConvexError({ code: "forbidden" });
  return user;
}

// Mission en cours du camion : chargée d'abord, sinon à charger (la plus récente).
export async function currentMission(ctx: QueryCtx, truckId: Id<"trucks">): Promise<Doc<"missions"> | null> {
  for (const status of ["loaded", "assigned"] as const) {
    const mission = await ctx.db.query("missions")
      .withIndex("by_truckId_and_status", (q) => q.eq("truckId", truckId).eq("status", status))
      .order("desc")
      .first();
    if (mission) return mission;
  }
  return null;
}

export function latestPosition(ctx: QueryCtx, truckId: Id<"trucks">) {
  return ctx.db.query("positions").withIndex("by_truckId", (q) => q.eq("truckId", truckId)).unique();
}

export function linksOfDriver(ctx: QueryCtx, driverId: Id<"drivers">) {
  return ctx.db.query("trackingLinks").withIndex("by_driverId", (q) => q.eq("driverId", driverId)).take(100);
}

export function linksOfTruck(ctx: QueryCtx, truckId: Id<"trucks">) {
  return ctx.db.query("trackingLinks").withIndex("by_truckId", (q) => q.eq("truckId", truckId)).take(100);
}

// Dernier lien non révoqué du conducteur. L'expiration est comparée par l'appelant : pas d'horloge dans les requêtes.
export async function latestLink(ctx: QueryCtx, driverId: Id<"drivers">) {
  const link = await ctx.db.query("trackingLinks").withIndex("by_driverId", (q) => q.eq("driverId", driverId)).order("desc").first();
  return link && !link.revokedAt ? link : null;
}

export async function revokeLinks(ctx: MutationCtx, links: Doc<"trackingLinks">[]) {
  const now = Date.now();
  for (const link of links) if (!link.revokedAt) await ctx.db.patch("trackingLinks", link._id, { revokedAt: now });
}
