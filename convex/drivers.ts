import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { latestLink, linksOfDriver, requireFleetOwner, revokeLinks } from "./lib/fleet";

// Conducteurs d'une entreprise (transporteur avec 2 véhicules ou plus) : pas de compte, au plus un camion chacun.

function clean(input: { name: string; phone: string }) {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new ConvexError({ code: "invalid_name" });
  const phone = input.phone.trim().slice(0, 25);
  const digits = phone.replace(/\D/g, "").length;
  if (digits < 6 || digits > 15) throw new ConvexError({ code: "invalid_phone" });
  return { name, phone };
}

async function ownedDriver(ctx: MutationCtx, ownerId: Id<"users">, driverId: Id<"drivers">) {
  const driver = await ctx.db.get("drivers", driverId);
  if (!driver || driver.ownerId !== ownerId) throw new ConvexError({ code: "not_found" });
  return driver;
}

async function checkTruck(ctx: MutationCtx, ownerId: Id<"users">, truckId: Id<"trucks"> | undefined) {
  if (!truckId) return;
  const truck = await ctx.db.get("trucks", truckId);
  if (!truck || truck.ownerId !== ownerId) throw new ConvexError({ code: "invalid_truck" });
}

// Garde les deux côtés cohérents (drivers.truckId et trucks.driverId) : un camion n'a qu'un conducteur.
async function assignTruck(ctx: MutationCtx, driverId: Id<"drivers">, previous: Id<"trucks"> | undefined, next: Id<"trucks"> | undefined) {
  if (previous === next) return;
  if (previous) {
    const truck = await ctx.db.get("trucks", previous);
    if (truck?.driverId === driverId) await ctx.db.patch("trucks", previous, { driverId: undefined });
  }
  if (next) {
    const truck = await ctx.db.get("trucks", next);
    if (truck?.driverId && truck.driverId !== driverId) {
      const displaced = await ctx.db.get("drivers", truck.driverId);
      if (displaced) await ctx.db.patch("drivers", displaced._id, { truckId: undefined, updatedAt: Date.now() });
    }
    await ctx.db.patch("trucks", next, { driverId });
  }
}

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireFleetOwner(ctx, token);
    const drivers = await ctx.db.query("drivers").withIndex("by_ownerId", (q) => q.eq("ownerId", user._id)).take(200);
    return Promise.all(drivers.map(async (driver) => {
      const truck = driver.truckId ? await ctx.db.get("trucks", driver.truckId) : null;
      const link = await latestLink(ctx, driver._id);
      return {
        _id: driver._id,
        name: driver.name,
        phone: driver.phone,
        disabled: driver.disabled,
        truckId: driver.truckId ?? null,
        truckName: truck?.name ?? null,
        // Un lien créé pour un autre camion ne marche plus : on ne l'affiche pas comme actif.
        linkExpiresAt: link && !driver.disabled && link.truckId === driver.truckId ? link.expiresAt : null,
      };
    }));
  },
});

export const create = mutation({
  args: { token: v.string(), name: v.string(), phone: v.string(), truckId: v.optional(v.id("trucks")) },
  handler: async (ctx, { token, truckId, ...input }) => {
    const user = await requireFleetOwner(ctx, token);
    const fields = clean(input);
    await checkTruck(ctx, user._id, truckId);
    const driverId = await ctx.db.insert("drivers", { ...fields, ownerId: user._id, truckId, disabled: false, updatedAt: Date.now() });
    await assignTruck(ctx, driverId, undefined, truckId);
    return driverId;
  },
});

export const update = mutation({
  args: { token: v.string(), driverId: v.id("drivers"), name: v.string(), phone: v.string(), truckId: v.optional(v.id("trucks")) },
  handler: async (ctx, { token, driverId, truckId, ...input }) => {
    const user = await requireFleetOwner(ctx, token);
    const driver = await ownedDriver(ctx, user._id, driverId);
    const fields = clean(input);
    await checkTruck(ctx, user._id, truckId);
    await assignTruck(ctx, driverId, driver.truckId, truckId);
    await ctx.db.patch("drivers", driverId, { ...fields, truckId, updatedAt: Date.now() });
    return null;
  },
});

export const setDisabled = mutation({
  args: { token: v.string(), driverId: v.id("drivers"), disabled: v.boolean() },
  handler: async (ctx, { token, driverId, disabled }) => {
    const user = await requireFleetOwner(ctx, token);
    await ownedDriver(ctx, user._id, driverId);
    await ctx.db.patch("drivers", driverId, { disabled, updatedAt: Date.now() });
    if (disabled) await revokeLinks(ctx, await linksOfDriver(ctx, driverId));
    return null;
  },
});
