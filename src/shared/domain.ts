// Vocabulaire métier partagé entre le navigateur, le rendu serveur et Convex.

export const LANGS = ["fr", "en", "pt"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "pt"; // langue officielle de la Guinée-Bissau
export const isLang = (value: unknown): value is Lang => LANGS.includes(value as Lang);

export const ROLES = ["admin", "transporter", "producer"] as const;
export type Role = (typeof ROLES)[number];
export const SIGNUP_ROLES = ["producer", "transporter"] as const; // l'admin n'est jamais créé par inscription

// Types de véhicules « comme on les appelle ici », dans l'ordre d'affichage (le camion d'abord).
export const VEHICLE_CATEGORIES = ["camion", "camionnette", "moto_tricycle", "tracteur", "semi_remorque"] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export const LISTING_MODES = ["transport", "rental", "sale"] as const;
export type ListingMode = (typeof LISTING_MODES)[number];

export const AVAILABILITIES = ["available", "in_transit", "maintenance"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const PRODUCT_TYPES = ["cashew", "rice", "other"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const MISSION_STATUSES = ["pending", "assigned", "loaded", "delivered", "cancelled"] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const MISSION_EVENT_TYPES = ["created", "assigned", "loaded", "delivered", "cancelled"] as const;
export type MissionEventType = (typeof MISSION_EVENT_TYPES)[number];

export const PIN_PATTERN = /^\d{4,6}$/;
export const normalizePhone = (phone: string) => phone.replace(/\D/g, "");
