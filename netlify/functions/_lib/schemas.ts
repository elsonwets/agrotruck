import { z } from "zod";
import { vehicleCategories, type VehicleCategory } from "../../../data/vehicle-categories";
import { zones, type Zone } from "../../../data/zones";

export const zoneSchema = z.enum(zones.map(({ id }) => id) as [Zone, ...Zone[]]);
export const categorySchema = z.enum(vehicleCategories.map(({ id }) => id) as [VehicleCategory, ...VehicleCategory[]]);
export const phoneSchema = z.string().trim().regex(/^\+?[\d\s-]{7,20}$/);
export const pinSchema = z.string().regex(/^\d{4,6}$/);
export const optionalText = (max: number) => z.string().trim().max(max).optional();
