import { v, type VLiteral } from "convex/values";
import {
  AVAILABILITIES, LANGS, LISTING_MODES, MISSION_EVENT_TYPES, MISSION_STATUSES, PRODUCT_TYPES, ROLES, VEHICLE_CATEGORIES,
} from "../../src/shared/domain";
import { zones } from "../../src/shared/zones";
import { OFFER_STATUSES } from "../../src/shared/offers";

// Validateurs Convex construits à partir des mêmes listes que l'interface : une seule source de vérité.
const literals = <const T extends readonly string[]>(values: T) =>
  v.union(...(values.map((value) => v.literal(value)) as VLiteral<T[number], "required">[]));

export const vRole = literals(ROLES);
export const vLang = literals(LANGS);
export const vCategory = literals(VEHICLE_CATEGORIES);
export const vCategoryOrAny = v.union(vCategory, v.literal("any"));
export const vListingMode = literals(LISTING_MODES);
export const vAvailability = literals(AVAILABILITIES);
export const vProductType = literals(PRODUCT_TYPES);
export const vMissionStatus = literals(MISSION_STATUSES);
export const vMissionEventType = literals(MISSION_EVENT_TYPES);
export const vZone = literals(zones.map(({ id }) => id));
export const vOfferStatus = literals(OFFER_STATUSES);
export const vGps = v.object({ lat: v.number(), lng: v.number() });

export const vMissionEvent = v.object({
  type: vMissionEventType,
  userId: v.optional(v.string()),
  at: v.number(),
  comment: v.optional(v.string()),
});
