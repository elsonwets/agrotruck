import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { matchesTransporter, transition } from "../src/shared/missions";
import { canSee, declinePendingOffers, profileOf, truckCategories, view } from "./lib/missionView";
import { requireUser } from "./lib/session";
import { vCategoryOrAny, vGps, vProductType, vZone } from "./lib/validators";

// Missions de transport : le producteur publie, les transporteurs font des offres (offers.ts), le producteur en
// retient une, puis chargement et livraison. Chaque mutation Convex est une transaction sérialisable.

export const create = mutation({
  args: {
    token: v.string(),
    clientRequestId: v.optional(v.string()),
    vehicleCategory: vCategoryOrAny,
    pickupZone: vZone,
    pickupLocation: v.string(),
    pickupGps: v.optional(vGps),
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
    const { lat, lng } = input.pickupGps ?? { lat: 0, lng: 0 };
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new ConvexError({ code: "invalid_location" });
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

// Missions proposées au transporteur (bon type de véhicule ET bonne région), avec son offre s'il en a fait une.
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

// Missions attribuées au transporteur (son offre a été retenue, ou assignation par l'admin).
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

// Assigner (admin), chargé, livré, annuler. Refus = ConvexError({ code }) traduit par l'interface.
export const act = mutation({
  args: {
    token: v.string(),
    missionId: v.id("missions"),
    action: v.union(v.literal("assign"), v.literal("loaded"), v.literal("delivered"), v.literal("cancel")),
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
      (action === "loaded" && mission.status !== "assigned" && mission.events.some((event) => event.type === "loaded" && event.userId === user._id))
      || (action === "delivered" && mission.events.some((event) => event.type === "delivered" && event.userId === user._id));
    if (alreadyDone) return view(ctx, mission, user);
    if (!(await canSee(ctx, mission, user))) throw new ConvexError({ code: "not_found" });
    if (action === "assign") {
      const transporter = transporterId ? await ctx.db.get("users", transporterId) : null;
      if (!transporter || transporter.role !== "transporter" || transporter.disabled) throw new ConvexError({ code: "transporter_required" });
    }
    const now = Date.now();
    // L'heure fournie est gardée si elle est plausible : ni dans le futur, ni avant la création de la mission.
    const when = at !== undefined && at <= now + 60_000 && at >= mission._creationTime ? at : now;
    const result = transition(mission, action, { userId: user._id, role: user.role }, {
      at: when, transporterId, comment: comment?.trim().slice(0, 300) || undefined,
    });
    if (!result.ok) throw new ConvexError({ code: result.error });
    await ctx.db.patch("missions", missionId, {
      status: result.mission.status,
      transporterId: result.mission.transporterId as Id<"users"> | undefined,
      events: result.mission.events,
      updatedAt: result.mission.updatedAt,
    });
    // Annulée ou attribuée à la main : les offres encore en attente sont refusées.
    if (action === "cancel" || action === "assign") await declinePendingOffers(ctx, missionId);
    const updated = await ctx.db.get("missions", missionId);
    return view(ctx, updated!, user);
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
