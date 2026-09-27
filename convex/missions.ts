import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { matchesTransporter, transition, type MissionAction } from "../src/shared/missions";
import type { VehicleCategory } from "../src/shared/domain";
import { requireUser } from "./lib/session";
import { vCategoryOrAny, vProductType, vZone } from "./lib/validators";

// Missions de transport. Chaque mutation Convex est une transaction sérialisable : deux « accepter » simultanés
// ne peuvent pas réussir tous les deux (le second relit la mission déjà prise et reçoit « already_taken »).

const contact = (user: Doc<"users"> | null, withPhone: boolean) =>
  user ? { name: user.companyName || user.displayName, ...(withPhone ? { phone: user.phone } : {}) } : null;

async function truckCategories(ctx: QueryCtx, userId: Id<"users">): Promise<VehicleCategory[]> {
  const trucks = await ctx.db.query("trucks").withIndex("by_ownerId", (q) => q.eq("ownerId", userId)).take(100);
  return trucks.filter((truck) => !truck.hidden).map((truck) => truck.category);
}

function profileOf(user: Doc<"users">) {
  return { id: user._id, role: user.role, disabled: user.disabled, vehicleCategories: user.vehicleCategories, workZones: user.workZones };
}

// Vue d'une mission selon qui la regarde : le numéro du producteur n'est donné qu'au transporteur assigné.
async function view(ctx: QueryCtx, mission: Doc<"missions">, viewer: Doc<"users">) {
  const isAssigned = viewer.role === "transporter" && mission.transporterId === viewer._id;
  const isOwner = viewer.role === "producer" && mission.producerId === viewer._id;
  const isAdmin = viewer.role === "admin";
  const producer = await ctx.db.get("users", mission.producerId);
  const transporter = mission.transporterId ? await ctx.db.get("users", mission.transporterId) : null;
  return {
    ...mission,
    createdAt: mission._creationTime,
    producer: contact(producer, isAssigned || isOwner || isAdmin),
    transporter: contact(transporter, isOwner || isAssigned || isAdmin),
  };
}

async function canSee(ctx: QueryCtx, mission: Doc<"missions">, user: Doc<"users">): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "producer") return mission.producerId === user._id;
  if (mission.transporterId === user._id) return true;
  return matchesTransporter(mission, profileOf(user), await truckCategories(ctx, user._id));
}

export const create = mutation({
  args: {
    token: v.string(),
    clientRequestId: v.optional(v.string()),
    vehicleCategory: vCategoryOrAny,
    pickupZone: vZone,
    pickupLocation: v.string(),
    dropoffZone: vZone,
    dropoffLocation: v.string(),
    productType: vProductType,
    quantitySacks: v.optional(v.number()),
    quantityKg: v.optional(v.number()),
    neededFrom: v.string(),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, { token, clientRequestId, ...input }) => {
    const user = await requireUser(ctx, token, ["producer"]);
    if (clientRequestId) {
      // Demande publiée hors ligne et rejouée : on renvoie la mission déjà créée au lieu d'en créer une autre.
      const existing = await ctx.db.query("missions").withIndex("by_clientRequestId", (q) => q.eq("clientRequestId", clientRequestId)).unique();
      if (existing) {
        if (existing.producerId !== user._id) throw new ConvexError({ code: "conflict" });
        return existing._id;
      }
    }
    const pickupLocation = input.pickupLocation.trim().slice(0, 200);
    const dropoffLocation = input.dropoffLocation.trim().slice(0, 200);
    if (!pickupLocation || !dropoffLocation) throw new ConvexError({ code: "invalid_location" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.neededFrom)) throw new ConvexError({ code: "invalid_date" });
    const quantitySacks = input.quantitySacks && input.quantitySacks > 0 ? Math.round(input.quantitySacks) : undefined;
    const quantityKg = input.quantityKg && input.quantityKg > 0 ? input.quantityKg : undefined;
    if (!quantitySacks && !quantityKg) throw new ConvexError({ code: "quantity_required" });
    const now = Date.now();
    return ctx.db.insert("missions", {
      ...input,
      pickupLocation,
      dropoffLocation,
      quantitySacks,
      quantityKg,
      comment: input.comment?.trim().slice(0, 500) ?? "",
      clientRequestId,
      producerId: user._id,
      status: "pending",
      events: [{ type: "created", userId: user._id, at: now }],
      updatedAt: now,
    });
  },
});

export const mine = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token, ["producer"]);
    const missions = await ctx.db.query("missions").withIndex("by_producerId", (q) => q.eq("producerId", user._id)).order("desc").take(200);
    return Promise.all(missions.map((mission) => view(ctx, mission, user)));
  },
});

// Missions proposées au transporteur : bon type de véhicule ET bonne région de chargement.
export const available = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token, ["transporter"]);
    const categories = await truckCategories(ctx, user._id);
    const pending = await ctx.db.query("missions").withIndex("by_status", (q) => q.eq("status", "pending")).order("desc").take(300);
    const offered = pending.filter((mission) => matchesTransporter(mission, profileOf(user), categories));
    return Promise.all(offered.map((mission) => view(ctx, mission, user)));
  },
});

export const assigned = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token, ["transporter"]);
    const missions = await ctx.db.query("missions").withIndex("by_transporterId", (q) => q.eq("transporterId", user._id)).order("desc").take(200);
    return Promise.all(missions.map((mission) => view(ctx, mission, user)));
  },
});

export const get = query({
  args: { token: v.string(), missionId: v.id("missions") },
  handler: async (ctx, { token, missionId }) => {
    const user = await requireUser(ctx, token);
    const mission = await ctx.db.get("missions", missionId);
    if (!mission || !(await canSee(ctx, mission, user))) return null;
    return view(ctx, mission, user);
  },
});

// Accepter, assigner, chargé, livré, annuler. Refus = ConvexError({ code }) traduit par l'interface.
export const act = mutation({
  args: {
    token: v.string(),
    missionId: v.id("missions"),
    action: v.union(v.literal("accept"), v.literal("assign"), v.literal("loaded"), v.literal("delivered"), v.literal("cancel")),
    at: v.optional(v.number()), // heure réelle de l'action (ex. faite hors ligne)
    comment: v.optional(v.string()),
    transporterId: v.optional(v.id("users")),
  },
  handler: async (ctx, { token, missionId, action, at, comment, transporterId }) => {
    const user = await requireUser(ctx, token);
    const mission = await ctx.db.get("missions", missionId);
    if (!mission) throw new ConvexError({ code: "not_found" });
    // Idempotence : une action déjà faite par la même personne (ex. rejouée après une coupure réseau) n'est pas refusée.
    const alreadyDone =
      (action === "accept" && mission.transporterId === user._id && mission.status !== "pending")
      || (action === "loaded" && mission.status !== "assigned" && mission.events.some((event) => event.type === "loaded" && event.userId === user._id))
      || (action === "delivered" && mission.events.some((event) => event.type === "delivered" && event.userId === user._id));
    if (alreadyDone) return view(ctx, mission, user);
    if (action === "accept") {
      if (mission.status !== "pending" && mission.transporterId !== user._id) throw new ConvexError({ code: "already_taken" });
      if (!matchesTransporter(mission, profileOf(user), await truckCategories(ctx, user._id))) throw new ConvexError({ code: "not_offered" });
    } else if (!(await canSee(ctx, mission, user))) {
      throw new ConvexError({ code: "not_found" });
    }
    if (action === "assign") {
      const transporter = transporterId ? await ctx.db.get("users", transporterId) : null;
      if (!transporter || transporter.role !== "transporter" || transporter.disabled) throw new ConvexError({ code: "transporter_required" });
    }
    const now = Date.now();
    // L'heure fournie est gardée si elle est plausible : ni dans le futur, ni avant la création de la mission.
    const when = at !== undefined && at <= now + 60_000 && at >= mission._creationTime ? at : now;
    const result = transition(mission, action as MissionAction, { userId: user._id, role: user.role }, {
      at: when, transporterId, comment: comment?.trim().slice(0, 300) || undefined,
    });
    if (!result.ok) throw new ConvexError({ code: result.error });
    await ctx.db.patch("missions", missionId, {
      status: result.mission.status,
      transporterId: result.mission.transporterId as Id<"users"> | undefined,
      events: result.mission.events,
      updatedAt: result.mission.updatedAt,
    });
    return view(ctx, { ...mission, ...result.mission, transporterId: result.mission.transporterId as Id<"users"> | undefined }, user);
  },
});

// Vue admin : toutes les missions, les contacts, et pour une mission en attente les transporteurs qui correspondent.
export const adminList = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const admin = await requireUser(ctx, token, ["admin"]);
    const missions = await ctx.db.query("missions").order("desc").take(500);
    const transporters = (await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "transporter")).take(500)).filter((user) => !user.disabled);
    const categories = new Map(await Promise.all(transporters.map(async (user) => [user._id, await truckCategories(ctx, user._id)] as const)));
    return Promise.all(missions.map(async (mission) => ({
      ...(await view(ctx, mission, admin)),
      candidateIds: mission.status === "pending"
        ? transporters.filter((user) => matchesTransporter(mission, profileOf(user), categories.get(user._id))).map((user) => user._id)
        : undefined,
    })));
  },
});

