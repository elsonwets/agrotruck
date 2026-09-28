import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { matchesTransporter } from "../../src/shared/missions";
import type { VehicleCategory } from "../../src/shared/domain";

// Aides partagées par missions.ts et offers.ts.

export const contact = (user: Doc<"users"> | null, withPhone: boolean) =>
  user ? { name: user.companyName || user.displayName, ...(withPhone ? { phone: user.phone } : {}) } : null;

export async function truckCategories(ctx: QueryCtx, userId: Id<"users">): Promise<VehicleCategory[]> {
  const trucks = await ctx.db.query("trucks").withIndex("by_ownerId", (q) => q.eq("ownerId", userId)).take(100);
  return trucks.filter((truck) => !truck.hidden).map((truck) => truck.category);
}

export function profileOf(user: Doc<"users">) {
  return { id: user._id, role: user.role, disabled: user.disabled, vehicleCategories: user.vehicleCategories, workZones: user.workZones };
}

// La mission est-elle proposée à ce transporteur (bon type de véhicule + bonne région, mission en attente) ?
export async function isOfferedTo(ctx: QueryCtx, mission: Doc<"missions">, user: Doc<"users">): Promise<boolean> {
  return matchesTransporter(mission, profileOf(user), await truckCategories(ctx, user._id));
}

export async function canSee(ctx: QueryCtx, mission: Doc<"missions">, user: Doc<"users">): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "producer") return mission.producerId === user._id;
  if (mission.transporterId === user._id) return true;
  // Un transporteur qui a fait une offre garde l'accès (pour voir si elle a été retenue).
  const offer = await ctx.db.query("offers").withIndex("by_missionId_and_transporterId", (q) => q.eq("missionId", mission._id).eq("transporterId", user._id)).unique();
  return Boolean(offer) || isOfferedTo(ctx, mission, user);
}

export async function truckSummary(ctx: QueryCtx, truckId: Id<"trucks"> | undefined) {
  const truck = truckId ? await ctx.db.get("trucks", truckId) : null;
  if (!truck) return null;
  const ratings = truck.ratings;
  return {
    _id: truck._id,
    slug: truck.slug,
    name: truck.name,
    category: truck.category,
    capacityTons: truck.capacityTons,
    hidden: truck.hidden,
    photoUrl: truck.photoIds[0] ? await ctx.storage.getUrl(truck.photoIds[0]) : null,
    rating: ratings?.count
      ? { count: ratings.count, overall: Number(((ratings.vehicleQuality + ratings.professionalism + ratings.reliability) / (3 * ratings.count)).toFixed(1)) }
      : null,
  };
}

// Vue d'une mission selon qui la regarde :
// - le numéro du producteur n'est donné qu'au transporteur retenu ;
// - un transporteur voit sa propre offre ; le producteur et l'admin voient le nombre d'offres en attente.
export async function view(ctx: QueryCtx, mission: Doc<"missions">, viewer: Doc<"users">) {
  const isAssigned = viewer.role === "transporter" && mission.transporterId === viewer._id;
  const isOwner = viewer.role === "producer" && mission.producerId === viewer._id;
  const isAdmin = viewer.role === "admin";
  const producer = await ctx.db.get("users", mission.producerId);
  const transporter = mission.transporterId ? await ctx.db.get("users", mission.transporterId) : null;
  const myOffer = viewer.role === "transporter"
    ? await ctx.db.query("offers").withIndex("by_missionId_and_transporterId", (q) => q.eq("missionId", mission._id).eq("transporterId", viewer._id)).unique()
    : null;
  const pendingOffers = isOwner || isAdmin
    ? (await ctx.db.query("offers").withIndex("by_missionId", (q) => q.eq("missionId", mission._id)).take(100)).filter((offer) => offer.status === "pending").length
    : undefined;
  return {
    ...mission,
    createdAt: mission._creationTime,
    producer: contact(producer, isAssigned || isOwner || isAdmin),
    transporter: contact(transporter, isOwner || isAssigned || isAdmin),
    truck: isOwner || isAssigned || isAdmin ? await truckSummary(ctx, mission.truckId) : null,
    myOffer: myOffer ? { _id: myOffer._id, price: myOffer.price, truckId: myOffer.truckId, message: myOffer.message, status: myOffer.status } : null,
    pendingOffers,
  };
}

// Une fois la mission attribuée (ou annulée), les offres encore en attente sont refusées.
export async function declinePendingOffers(ctx: MutationCtx, missionId: Id<"missions">, keep?: Id<"offers">) {
  const offers = await ctx.db.query("offers").withIndex("by_missionId", (q) => q.eq("missionId", missionId)).take(200);
  const now = Date.now();
  for (const offer of offers) {
    if (offer.status === "pending" && offer._id !== keep) await ctx.db.patch("offers", offer._id, { status: "declined", updatedAt: now });
  }
}
