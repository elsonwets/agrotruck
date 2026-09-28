import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { transition } from "../src/shared/missions";
import { isValidPrice, sortOffers } from "../src/shared/offers";
import { contact, declinePendingOffers, isOfferedTo, truckSummary, view } from "./lib/missionView";
import { requireUser } from "./lib/session";

// Offres : les transporteurs de la bonne région et du bon type de véhicule proposent un prix ; le producteur
// en retient une seule. Chaque mutation est une transaction : une mission ne peut être attribuée qu'une fois.

// Envoyer ou modifier son offre (tant que le producteur n'a pas choisi).
export const send = mutation({
  args: {
    token: v.string(),
    missionId: v.id("missions"),
    price: v.number(),
    truckId: v.optional(v.id("trucks")),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { token, missionId, price, truckId, message }) => {
    const user = await requireUser(ctx, token, ["transporter"]);
    const mission = await ctx.db.get("missions", missionId);
    if (!mission) throw new ConvexError({ code: "not_found" });
    if (mission.status !== "pending") throw new ConvexError({ code: "already_taken" });
    if (!(await isOfferedTo(ctx, mission, user))) throw new ConvexError({ code: "not_offered" });
    if (!isValidPrice(price)) throw new ConvexError({ code: "invalid_price" });
    if (truckId) {
      const truck = await ctx.db.get("trucks", truckId);
      if (!truck || truck.ownerId !== user._id || truck.hidden) throw new ConvexError({ code: "invalid_truck" });
    }
    const fields = { price, truckId, message: message?.trim().slice(0, 300) ?? "", status: "pending" as const, updatedAt: Date.now() };
    const existing = await ctx.db.query("offers").withIndex("by_missionId_and_transporterId", (q) => q.eq("missionId", missionId).eq("transporterId", user._id)).unique();
    if (existing) {
      if (existing.status === "accepted" || existing.status === "declined") throw new ConvexError({ code: "offer_closed" });
      await ctx.db.patch("offers", existing._id, fields);
      return existing._id;
    }
    return ctx.db.insert("offers", { missionId, transporterId: user._id, ...fields });
  },
});

export const withdraw = mutation({
  args: { token: v.string(), missionId: v.id("missions") },
  handler: async (ctx, { token, missionId }) => {
    const user = await requireUser(ctx, token, ["transporter"]);
    const offer = await ctx.db.query("offers").withIndex("by_missionId_and_transporterId", (q) => q.eq("missionId", missionId).eq("transporterId", user._id)).unique();
    if (!offer) throw new ConvexError({ code: "not_found" });
    if (offer.status !== "pending") throw new ConvexError({ code: "offer_closed" });
    await ctx.db.patch("offers", offer._id, { status: "withdrawn", updatedAt: Date.now() });
    return null;
  },
});

// Offres reçues sur une mission (producteur propriétaire ou admin) : prix, transporteur (avec son numéro, pour
// pouvoir l'appeler avant de choisir) et camion proposé.
export const forMission = query({
  args: { token: v.string(), missionId: v.id("missions") },
  handler: async (ctx, { token, missionId }) => {
    const user = await requireUser(ctx, token, ["producer", "admin"]);
    const mission = await ctx.db.get("missions", missionId);
    if (!mission || (user.role === "producer" && mission.producerId !== user._id)) return [];
    const offers = await ctx.db.query("offers").withIndex("by_missionId", (q) => q.eq("missionId", missionId)).take(100);
    const visible = offers.filter((offer) => offer.status !== "withdrawn");
    return sortOffers(await Promise.all(visible.map(async (offer) => {
      const transporter = await ctx.db.get("users", offer.transporterId);
      return {
        _id: offer._id,
        price: offer.price,
        message: offer.message,
        status: offer.status,
        updatedAt: offer.updatedAt,
        transporterId: offer.transporterId,
        transporter: transporter && !transporter.disabled ? contact(transporter, true) : null,
        truck: await truckSummary(ctx, offer.truckId),
      };
    }))).filter((offer) => offer.transporter);
  },
});

// Le producteur retient une offre : la mission est attribuée à ce transporteur au prix convenu,
// les autres offres sont refusées.
export const choose = mutation({
  args: { token: v.string(), offerId: v.id("offers") },
  handler: async (ctx, { token, offerId }) => {
    const user = await requireUser(ctx, token, ["producer"]);
    const offer = await ctx.db.get("offers", offerId);
    if (!offer) throw new ConvexError({ code: "not_found" });
    const mission = await ctx.db.get("missions", offer.missionId);
    if (!mission || mission.producerId !== user._id) throw new ConvexError({ code: "not_found" });
    if (offer.status !== "pending") throw new ConvexError({ code: "offer_closed" });
    const transporter = await ctx.db.get("users", offer.transporterId);
    if (!transporter || transporter.disabled) throw new ConvexError({ code: "transporter_required" });

    const result = transition(mission, "choose", { userId: user._id, role: user.role }, { transporterId: offer.transporterId });
    if (!result.ok) throw new ConvexError({ code: result.error });
    await ctx.db.patch("missions", mission._id, {
      status: result.mission.status,
      transporterId: offer.transporterId,
      events: result.mission.events,
      updatedAt: result.mission.updatedAt,
      acceptedOfferId: offer._id,
      agreedPrice: offer.price,
      truckId: offer.truckId,
    });
    await ctx.db.patch("offers", offer._id, { status: "accepted", updatedAt: Date.now() });
    await declinePendingOffers(ctx, mission._id, offer._id);
    const updated = await ctx.db.get("missions", mission._id);
    return view(ctx, updated!, user);
  },
});
