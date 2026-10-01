import { ConvexError, v, type ObjectType } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { formatPhone } from "../src/shared/domain";
import { requireUser } from "./lib/session";
import { vAvailability, vCategory, vListingMode, vZone } from "./lib/validators";

// Annonces de véhicules. Pas de validation : un transporteur publie directement ; l'admin peut masquer une annonce.

const MAX_PHOTOS = 6;
const CATALOG_SIZE = 60;

const truckFields = {
  name: v.string(),
  category: vCategory,
  listingMode: vListingMode,
  brand: v.optional(v.string()),
  model: v.optional(v.string()),
  capacityTons: v.number(),
  zone: vZone,
  location: v.string(),
  serviceZones: v.array(vZone),
  goods: v.array(v.string()),
  availability: vAvailability,
  description: v.string(),
  photoIds: v.array(v.id("_storage")),
  whatsapp: v.optional(v.string()),
};

function clean(input: ObjectType<typeof truckFields>) {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new ConvexError({ code: "invalid_name" });
  if (!(input.capacityTons >= 0 && input.capacityTons <= 100)) throw new ConvexError({ code: "invalid_capacity" });
  if (input.photoIds.length > MAX_PHOTOS) throw new ConvexError({ code: "too_many_photos" });
  return {
    ...input,
    name,
    brand: input.brand?.trim().slice(0, 40) || undefined,
    model: input.model?.trim().slice(0, 40) || undefined,
    location: input.location.trim().slice(0, 120),
    serviceZones: [...new Set(input.serviceZones)],
    goods: input.goods.map((good) => good.trim().slice(0, 40)).filter(Boolean).slice(0, 12),
    description: input.description.trim().slice(0, 1500),
    whatsapp: input.whatsapp?.trim() ? formatPhone(input.whatsapp).slice(0, 25) : undefined,
  };
}

export function slugify(name: string): string {
  const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50) || "vehicule";
  const suffix = new Uint8Array(3);
  crypto.getRandomValues(suffix);
  return `${base}-${[...suffix].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function ratingSummary(truck: Doc<"trucks">) {
  const ratings = truck.ratings;
  if (!ratings?.count) return null;
  const average = (sum: number) => Number((sum / ratings.count).toFixed(1));
  const vehicleQuality = average(ratings.vehicleQuality), professionalism = average(ratings.professionalism), reliability = average(ratings.reliability);
  return { count: ratings.count, vehicleQuality, professionalism, reliability, overall: Number(((vehicleQuality + professionalism + reliability) / 3).toFixed(1)) };
}

async function photoUrls(ctx: QueryCtx, ids: Id<"_storage">[]) {
  return (await Promise.all(ids.map((id) => ctx.storage.getUrl(id)))).filter((url): url is string => Boolean(url));
}

// Carte publique (catalogue) : pas de téléphone, seulement ce qu'il faut pour choisir.
async function card(ctx: QueryCtx, truck: Doc<"trucks">, owner: Doc<"users">) {
  return {
    _id: truck._id,
    slug: truck.slug,
    name: truck.name,
    category: truck.category,
    listingMode: truck.listingMode,
    capacityTons: truck.capacityTons,
    zone: truck.zone,
    location: truck.location,
    serviceZones: truck.serviceZones,
    goods: truck.goods,
    availability: truck.availability,
    photoUrl: truck.photoIds[0] ? await ctx.storage.getUrl(truck.photoIds[0]) : null,
    ownerName: owner.companyName || owner.displayName,
    rating: ratingSummary(truck),
    updatedAt: truck.updatedAt,
  };
}

async function visibleOwner(ctx: QueryCtx, truck: Doc<"trucks">) {
  const owner = await ctx.db.get("users", truck.ownerId);
  return owner && !owner.disabled ? owner : null;
}

export const list = query({
  args: { listingMode: v.optional(vListingMode), category: v.optional(vCategory), zone: v.optional(vZone) },
  handler: async (ctx, args) => {
    const trucks = await ctx.db.query("trucks").withIndex("by_hidden", (q) => q.eq("hidden", false)).order("desc").take(300);
    const matching = trucks.filter((truck) =>
      (!args.listingMode || truck.listingMode === args.listingMode)
      && (!args.category || truck.category === args.category)
      && (!args.zone || truck.zone === args.zone || truck.serviceZones.includes(args.zone)));
    const cards = [];
    for (const truck of matching) {
      if (cards.length >= CATALOG_SIZE) break;
      const owner = await visibleOwner(ctx, truck);
      if (owner) cards.push(await card(ctx, truck, owner));
    }
    return cards;
  },
});

export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const truck = await ctx.db.query("trucks").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (!truck || truck.hidden) return null;
    const owner = await visibleOwner(ctx, truck);
    if (!owner) return null;
    return {
      ...(await card(ctx, truck, owner)),
      brand: truck.brand,
      model: truck.model,
      description: truck.description,
      photoUrls: await photoUrls(ctx, truck.photoIds),
      ownerPhone: owner.phone,
      whatsapp: truck.whatsapp || owner.phone,
    };
  },
});

// Pour le sitemap : annonces visibles, avec leur date de mise à jour.
export const sitemap = query({
  args: {},
  handler: async (ctx) => {
    const trucks = await ctx.db.query("trucks").withIndex("by_hidden", (q) => q.eq("hidden", false)).take(1000);
    return trucks.map((truck) => ({ slug: truck.slug, updatedAt: truck.updatedAt }));
  },
});

// --- Espace transporteur ---

export const mine = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireUser(ctx, token, ["transporter"]);
    const trucks = await ctx.db.query("trucks").withIndex("by_ownerId", (q) => q.eq("ownerId", user._id)).take(100);
    return Promise.all(trucks.map(async (truck) => ({ ...truck, photoUrls: await photoUrls(ctx, truck.photoIds) })));
  },
});

export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireUser(ctx, token, ["transporter", "admin"]);
    return ctx.storage.generateUploadUrl();
  },
});

async function ownedTruck(ctx: MutationCtx, token: string, truckId: Id<"trucks">) {
  const user = await requireUser(ctx, token, ["transporter", "admin"]);
  const truck = await ctx.db.get("trucks", truckId);
  if (!truck) throw new ConvexError({ code: "not_found" });
  if (user.role !== "admin" && truck.ownerId !== user._id) throw new ConvexError({ code: "forbidden" });
  return truck;
}

export const create = mutation({
  args: { token: v.string(), ...truckFields },
  handler: async (ctx, { token, ...input }) => {
    const user = await requireUser(ctx, token, ["transporter"]);
    const fields = clean(input);
    const id = await ctx.db.insert("trucks", { ...fields, ownerId: user._id, slug: slugify(fields.name), hidden: false, updatedAt: Date.now() });
    // Le type du véhicule s'ajoute aux types du transporteur : il verra les missions correspondantes.
    const categories = new Set(user.vehicleCategories ?? []);
    if (!categories.has(fields.category)) await ctx.db.patch("users", user._id, { vehicleCategories: [...categories, fields.category] });
    return id;
  },
});

export const update = mutation({
  args: { token: v.string(), truckId: v.id("trucks"), ...truckFields },
  handler: async (ctx, { token, truckId, ...input }) => {
    const truck = await ownedTruck(ctx, token, truckId);
    const fields = clean(input);
    for (const photoId of truck.photoIds) if (!fields.photoIds.includes(photoId)) await ctx.storage.delete(photoId);
    await ctx.db.patch("trucks", truckId, { ...fields, updatedAt: Date.now() });
    return null;
  },
});

export const setAvailability = mutation({
  args: { token: v.string(), truckId: v.id("trucks"), availability: vAvailability },
  handler: async (ctx, { token, truckId, availability }) => {
    await ownedTruck(ctx, token, truckId);
    await ctx.db.patch("trucks", truckId, { availability, updatedAt: Date.now() });
    return null;
  },
});

export const remove = mutation({
  args: { token: v.string(), truckId: v.id("trucks") },
  handler: async (ctx, { token, truckId }) => {
    const truck = await ownedTruck(ctx, token, truckId);
    for (const photoId of truck.photoIds) await ctx.storage.delete(photoId);
    const reviews = await ctx.db.query("reviews").withIndex("by_truckId", (q) => q.eq("truckId", truckId)).take(1000);
    for (const review of reviews) await ctx.db.delete("reviews", review._id);
    await ctx.db.delete("trucks", truckId);
    return null;
  },
});

// --- Administration ---

export const adminList = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await requireUser(ctx, token, ["admin"]);
    const trucks = await ctx.db.query("trucks").order("desc").take(500);
    return Promise.all(trucks.map(async (truck) => {
      const owner = await ctx.db.get("users", truck.ownerId);
      return { ...truck, ownerName: owner ? owner.companyName || owner.displayName : "—", ownerDisabled: owner?.disabled ?? false };
    }));
  },
});

export const setHidden = mutation({
  args: { token: v.string(), truckId: v.id("trucks"), hidden: v.boolean() },
  handler: async (ctx, { token, truckId, hidden }) => {
    await requireUser(ctx, token, ["admin"]);
    if (!(await ctx.db.get("trucks", truckId))) throw new ConvexError({ code: "not_found" });
    await ctx.db.patch("trucks", truckId, { hidden, updatedAt: Date.now() });
    return null;
  },
});

// Un producteur ne note que le transporteur qui l'a transporté, une fois la marchandise livrée
// (avec ce camion, ou sans camion précisé dans l'offre).
async function transportedBy(ctx: QueryCtx, producerId: Id<"users">, truck: Doc<"trucks">) {
  const missions = await ctx.db.query("missions").withIndex("by_producerId", (q) => q.eq("producerId", producerId)).order("desc").take(500);
  return missions.some((mission) => mission.status === "delivered" && mission.transporterId === truck.ownerId && (!mission.truckId || mission.truckId === truck._id));
}

// Le producteur connecté peut-il noter ce camion, et quelle note a-t-il déjà donnée ?
export const myReview = query({
  args: { token: v.string(), truckId: v.id("trucks") },
  handler: async (ctx, { token, truckId }) => {
    const user = await requireUser(ctx, token);
    const truck = await ctx.db.get("trucks", truckId);
    if (user.role !== "producer" || !truck || truck.hidden) return { allowed: false, review: null };
    const review = await ctx.db.query("reviews").withIndex("by_truckId_and_userId", (q) => q.eq("truckId", truckId).eq("userId", user._id)).unique();
    return {
      allowed: await transportedBy(ctx, user._id, truck),
      review: review ? { vehicleQuality: review.vehicleQuality, professionalism: review.professionalism, reliability: review.reliability } : null,
    };
  },
});

export const rate = mutation({
  args: {
    token: v.string(),
    truckId: v.id("trucks"),
    vehicleQuality: v.number(),
    professionalism: v.number(),
    reliability: v.number(),
  },
  handler: async (ctx, { token, truckId, ...scores }) => {
    const user = await requireUser(ctx, token, ["producer"]);
    if (Object.values(scores).some((score) => !Number.isInteger(score) || score < 1 || score > 5)) throw new ConvexError({ code: "invalid_rating" });
    const truck = await ctx.db.get("trucks", truckId);
    if (!truck || truck.hidden) throw new ConvexError({ code: "not_found" });
    if (!(await transportedBy(ctx, user._id, truck))) throw new ConvexError({ code: "not_transported" });
    const previous = await ctx.db.query("reviews").withIndex("by_truckId_and_userId", (q) => q.eq("truckId", truckId).eq("userId", user._id)).unique();
    const totals = truck.ratings ?? { count: 0, vehicleQuality: 0, professionalism: 0, reliability: 0 };
    const next = {
      count: totals.count + (previous ? 0 : 1),
      vehicleQuality: totals.vehicleQuality - (previous?.vehicleQuality ?? 0) + scores.vehicleQuality,
      professionalism: totals.professionalism - (previous?.professionalism ?? 0) + scores.professionalism,
      reliability: totals.reliability - (previous?.reliability ?? 0) + scores.reliability,
    };
    if (previous) await ctx.db.patch("reviews", previous._id, { ...scores, updatedAt: Date.now() });
    else await ctx.db.insert("reviews", { truckId, userId: user._id, ...scores, updatedAt: Date.now() });
    await ctx.db.patch("trucks", truckId, { ratings: next });
    return ratingSummary({ ...truck, ratings: next });
  },
});
