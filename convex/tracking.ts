import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { LINK_TTL_MS, SERVER_MIN_INTERVAL_MS, checkFix, firstName, progress } from "../src/shared/fleet";
import { currentMission, isFleetOwner, latestPosition, linksOfDriver, requireFleetOwner, revokeLinks } from "./lib/fleet";
import { newSessionToken, sha256 } from "./lib/security";
import { requireUser } from "./lib/session";

// Suivi GPS. Deux sources : le conducteur d'une entreprise (lien WhatsApp, sans compte) et le transporteur
// particulier (depuis son compte, pendant sa mission). On ne garde que la dernière position de chaque camion.

const fixArgs = {
  lat: v.number(),
  lng: v.number(),
  accuracy: v.optional(v.number()),
  speed: v.optional(v.number()),
  heading: v.optional(v.number()),
};

interface FixInput { lat: number; lng: number; accuracy?: number; speed?: number; heading?: number }

async function record(ctx: MutationCtx, truckId: Id<"trucks">, fix: FixInput, source: "owner" | "link", driverId?: Id<"drivers">) {
  const check = checkFix(fix);
  if (check === "invalid") throw new ConvexError({ code: "invalid_position" });
  if (check === "imprecise") return { recorded: false };
  const now = Date.now();
  const existing = await latestPosition(ctx, truckId);
  // Au plus un point toutes les 10 s par camion : les envois trop rapprochés sont ignorés sans erreur.
  if (existing && now - existing.at < SERVER_MIN_INTERVAL_MS) return { recorded: false };
  const position = { truckId, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, speed: fix.speed, heading: fix.heading, at: now, source, driverId };
  if (existing) await ctx.db.replace("positions", existing._id, position);
  else await ctx.db.insert("positions", position);
  return { recorded: true };
}

async function findLink(ctx: QueryCtx, linkToken: string) {
  const tokenHash = await sha256(linkToken);
  return ctx.db.query("trackingLinks").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
}

// Le lien est-il utilisable, hors expiration (comparée par l'appelant : pas d'horloge dans les requêtes) ?
async function linkUsable(ctx: QueryCtx, link: { revokedAt?: number; driverId: Id<"drivers">; truckId: Id<"trucks">; ownerId: Id<"users"> }) {
  if (link.revokedAt) return null;
  const driver = await ctx.db.get("drivers", link.driverId);
  const owner = await ctx.db.get("users", link.ownerId);
  if (!driver || driver.disabled || driver.truckId !== link.truckId || !owner || owner.disabled) return null;
  return (await isFleetOwner(ctx, owner._id)) ? driver : null;
}

export const createLink = mutation({
  args: { token: v.string(), driverId: v.id("drivers") },
  handler: async (ctx, { token, driverId }) => {
    const user = await requireFleetOwner(ctx, token);
    const driver = await ctx.db.get("drivers", driverId);
    if (!driver || driver.ownerId !== user._id) throw new ConvexError({ code: "not_found" });
    if (driver.disabled || !driver.truckId) throw new ConvexError({ code: "driver_unavailable" });
    // Un seul lien valide par conducteur : le nouveau remplace les anciens.
    await revokeLinks(ctx, await linksOfDriver(ctx, driverId));
    const linkToken = newSessionToken();
    const expiresAt = Date.now() + LINK_TTL_MS;
    const mission = await currentMission(ctx, driver.truckId);
    await ctx.db.insert("trackingLinks", {
      ownerId: user._id, driverId, truckId: driver.truckId, missionId: mission?._id, tokenHash: await sha256(linkToken), expiresAt,
    });
    return { linkToken, expiresAt };
  },
});

export const revokeLink = mutation({
  args: { token: v.string(), driverId: v.id("drivers") },
  handler: async (ctx, { token, driverId }) => {
    const user = await requireFleetOwner(ctx, token);
    const driver = await ctx.db.get("drivers", driverId);
    if (!driver || driver.ownerId !== user._id) throw new ConvexError({ code: "not_found" });
    await revokeLinks(ctx, await linksOfDriver(ctx, driverId));
    return null;
  },
});

// Page du conducteur : prénom, camion et validité du lien. Jamais de position ni de téléphone.
export const linkInfo = query({
  args: { linkToken: v.string() },
  handler: async (ctx, { linkToken }) => {
    const link = await findLink(ctx, linkToken);
    if (!link) return null;
    const driver = await ctx.db.get("drivers", link.driverId);
    const truck = await ctx.db.get("trucks", link.truckId);
    if (!driver || !truck) return null;
    const usable = await linkUsable(ctx, link);
    return { active: Boolean(usable), expiresAt: link.expiresAt, driverName: firstName(driver.name), truckName: truck.name, plate: truck.plate ?? null };
  },
});

export const reportFromLink = mutation({
  args: { linkToken: v.string(), ...fixArgs },
  handler: async (ctx, { linkToken, ...fix }) => {
    const link = await findLink(ctx, linkToken);
    const driver = link && link.expiresAt > Date.now() ? await linkUsable(ctx, link) : null;
    if (!link || !driver) throw new ConvexError({ code: "link_invalid" });
    return record(ctx, link.truckId, fix, "link", driver._id);
  },
});

export const reportFromOwner = mutation({
  args: { token: v.string(), truckId: v.id("trucks"), ...fixArgs },
  handler: async (ctx, { token, truckId, ...fix }) => {
    const user = await requireUser(ctx, token, ["transporter"]);
    const truck = await ctx.db.get("trucks", truckId);
    if (!truck || truck.ownerId !== user._id) throw new ConvexError({ code: "forbidden" });
    const mission = await currentMission(ctx, truckId);
    if (!mission || mission.transporterId !== user._id) throw new ConvexError({ code: "no_active_mission" });
    return record(ctx, truckId, fix, "owner");
  },
});

// Position du camion d'une mission en cours : producteur et transporteur de la mission, admin.
export const missionPosition = query({
  args: { token: v.string(), missionId: v.id("missions") },
  handler: async (ctx, { token, missionId }) => {
    const user = await requireUser(ctx, token);
    const mission = await ctx.db.get("missions", missionId);
    if (!mission?.truckId) return null;
    const ongoing = mission.status === "assigned" || mission.status === "loaded";
    const party = (user.role === "producer" && mission.producerId === user._id) || (user.role === "transporter" && mission.transporterId === user._id);
    if (user.role !== "admin" && !(ongoing && party)) return null;
    const position = await latestPosition(ctx, mission.truckId);
    const truck = await ctx.db.get("trucks", mission.truckId);
    const driver = position?.source === "link" && truck?.driverId ? await ctx.db.get("drivers", truck.driverId) : null;
    return {
      position: position ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy ?? null, at: position.at } : null,
      driverName: driver ? firstName(driver.name) : null,
      progress: progress(mission.pickupZone, mission.dropoffZone, mission.status, position),
    };
  },
});

export const purgeExpiredLinks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db.query("trackingLinks").withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now())).take(500);
    for (const link of expired) await ctx.db.delete("trackingLinks", link._id);
    return null;
  },
});
