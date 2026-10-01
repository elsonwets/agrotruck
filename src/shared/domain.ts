// Vocabulaire métier partagé entre le navigateur, le rendu serveur et Convex.

export const LANGS = ["en", "fr", "pt"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";
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
export const DIAL_CODE = "245"; // Guinée-Bissau

// Clé d'un numéro (chiffres seuls, indicatif compris) : « 955 00 00 00 » et « +245 955 00 00 00 » donnent la même.
// Sans « + » ni « 00 », le numéro est local et reçoit l'indicatif de Bissau.
export function normalizePhone(phone: string) {
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits;
  if (raw.startsWith("00")) return digits.slice(2);
  if (digits.startsWith(DIAL_CODE) && digits.length > 9) return digits;
  return DIAL_CODE + digits;
}

// Forme enregistrée et affichée : « +245955000000 ».
export const formatPhone = (phone: string) => `+${normalizePhone(phone)}`;

// 7 à 15 chiffres une fois l'indicatif ajouté (norme E.164).
export const isValidPhone = (phone: string) => /^\+?[\d\s().-]{6,22}$/.test(phone.trim()) && /^\d{7,15}$/.test(normalizePhone(phone));

// Numéro à afficher dans un champ : l'indicatif de Bissau est déjà affiché devant.
export const localPhone = (phone: string) => (phone.startsWith(`+${DIAL_CODE}`) ? phone.slice(DIAL_CODE.length + 1) : phone);
