import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vAvailability, vCategory, vCategoryOrAny, vLang, vListingMode, vMissionEvent, vMissionStatus, vProductType, vRole, vZone,
} from "./lib/validators";

export default defineSchema({
  // Comptes : producteurs et transporteurs s'inscrivent eux-mêmes ; l'admin est créé par `admin:bootstrap`.
  users: defineTable({
    phone: v.string(),
    phoneKey: v.string(), // chiffres seuls, pour l'unicité
    passwordHash: v.string(),
    role: vRole,
    displayName: v.string(),
    companyName: v.optional(v.string()),
    disabled: v.optional(v.boolean()),
    lang: v.optional(vLang),
    // Transporteur
    vehicleCategories: v.optional(v.array(vCategory)),
    capacityTons: v.optional(v.number()),
    workZones: v.optional(v.array(vZone)),
    // Producteur
    mainZone: v.optional(vZone),
    mainLocation: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_phoneKey", ["phoneKey"])
    .index("by_role", ["role"]),

  // Sessions : on ne garde que l'empreinte SHA-256 du jeton (un vol de la base ne donne pas accès aux comptes).
  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  // Compteurs de tentatives (connexion, inscription) : indispensables avec des PIN de 4 à 6 chiffres.
  attempts: defineTable({
    key: v.string(),
    count: v.number(),
    since: v.number(),
    lockedUntil: v.optional(v.number()),
  }).index("by_key", ["key"]),

  trucks: defineTable({
    ownerId: v.id("users"),
    slug: v.string(),
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
    photoIds: v.array(v.id("_storage")), // 6 au maximum
    whatsapp: v.optional(v.string()),
    hidden: v.boolean(), // masqué par l'admin
    // Sommes des notes (dénormalisées : le catalogue n'a pas à relire tous les avis).
    ratings: v.optional(v.object({ count: v.number(), vehicleQuality: v.number(), professionalism: v.number(), reliability: v.number() })),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_ownerId", ["ownerId"])
    .index("by_hidden", ["hidden"]),

  missions: defineTable({
    producerId: v.id("users"),
    transporterId: v.optional(v.id("users")),
    clientRequestId: v.optional(v.string()), // choisi par le téléphone : rejouer hors ligne ne crée pas de doublon
    vehicleCategory: vCategoryOrAny,
    pickupZone: vZone,
    pickupLocation: v.string(),
    dropoffZone: vZone,
    dropoffLocation: v.string(),
    productType: vProductType,
    quantitySacks: v.optional(v.number()),
    quantityKg: v.optional(v.number()),
    neededFrom: v.string(), // YYYY-MM-DD
    comment: v.string(),
    status: vMissionStatus,
    events: v.array(vMissionEvent), // 6 au plus (création, assignation, chargement, 2 livraisons, annulation)
    updatedAt: v.optional(v.number()),
  })
    .index("by_producerId", ["producerId"])
    .index("by_transporterId", ["transporterId"])
    .index("by_status", ["status"])
    .index("by_clientRequestId", ["clientRequestId"]),

  // Avis des producteurs sur un camion (un par producteur et par camion).
  reviews: defineTable({
    truckId: v.id("trucks"),
    userId: v.id("users"),
    vehicleQuality: v.number(),
    professionalism: v.number(),
    reliability: v.number(),
    updatedAt: v.number(),
  })
    .index("by_truckId", ["truckId"])
    .index("by_truckId_and_userId", ["truckId", "userId"]),
});
