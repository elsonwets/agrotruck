import type { MissionEventType, MissionStatus, ProductType, Role, VehicleCategory } from "./domain";
import { zoneLabels, type Zone } from "./zones";

// Règles des missions, identiques dans le navigateur (actions hors ligne) et dans Convex (source de vérité).
// Dates en millisecondes (comme Convex). Les erreurs sont des codes, traduits par l'interface.

export interface MissionEvent {
  type: MissionEventType;
  userId?: string;
  at: number;
  comment?: string;
}

export interface MissionCore {
  status: MissionStatus;
  producerId: string;
  transporterId?: string;
  events: MissionEvent[];
  updatedAt?: number;
}

export interface MissionFacts {
  vehicleCategory: VehicleCategory | "any";
  pickupZone: Zone;
  dropoffZone: Zone;
  productType: ProductType;
  quantityKg?: number;
  createdAt: number;
}

export type MissionAction = "accept" | "assign" | "loaded" | "delivered" | "cancel";
export interface Actor { userId: string; role: Role }

export type TransitionError =
  | "forbidden" | "already_taken" | "transporter_required" | "already_started"
  | "not_to_load" | "not_in_transit" | "already_confirmed" | "cannot_cancel";

export type TransitionResult<T> = { ok: true; mission: T } | { ok: false; status: 400 | 403 | 409; error: TransitionError };

export function isFinished(mission: Pick<MissionCore, "status">): boolean {
  return mission.status === "delivered" || mission.status === "cancelled";
}

// Machine à états. Le contrôle « type + région » de « accept » est fait par l'appelant (matchesTransporter).
export function transition<T extends MissionCore>(
  mission: T,
  action: MissionAction,
  actor: Actor,
  options: { at?: number; transporterId?: string; comment?: string } = {},
): TransitionResult<T> {
  const status = mission.status;
  const at = options.at ?? Date.now();
  const isAdmin = actor.role === "admin";
  const isAssignedTransporter = actor.role === "transporter" && mission.transporterId === actor.userId;
  const isOwner = actor.role === "producer" && mission.producerId === actor.userId;
  const fail = (code: 400 | 403 | 409, error: TransitionError): TransitionResult<T> => ({ ok: false, status: code, error });
  const forbidden = fail(403, "forbidden");
  const apply = (next: MissionStatus, type: MissionEventType, patch: Partial<MissionCore> = {}): TransitionResult<T> => ({
    ok: true,
    mission: {
      ...mission,
      ...patch,
      status: next,
      updatedAt: at,
      events: [...mission.events, { type, userId: actor.userId, at, ...(options.comment ? { comment: options.comment } : {}) }],
    },
  });

  switch (action) {
    case "accept":
      if (actor.role !== "transporter") return forbidden;
      if (status !== "pending") return fail(409, "already_taken");
      return apply("assigned", "assigned", { transporterId: actor.userId });
    case "assign":
      if (!isAdmin) return forbidden;
      if (!options.transporterId) return fail(400, "transporter_required");
      if (status !== "pending" && status !== "assigned") return fail(409, "already_started");
      return apply("assigned", "assigned", { transporterId: options.transporterId });
    case "loaded":
      if (!isAssignedTransporter && !isOwner && !isAdmin) return forbidden;
      if (status !== "assigned") return fail(409, "not_to_load");
      return apply("loaded", "loaded");
    case "delivered":
      if (!isAssignedTransporter && !isOwner && !isAdmin) return forbidden;
      if (status === "delivered") {
        // Double validation : l'autre partie peut confirmer la livraison une fois.
        const confirmed = mission.events.some((event) => event.type === "delivered" && event.userId === actor.userId);
        return confirmed ? fail(409, "already_confirmed") : apply("delivered", "delivered");
      }
      if (status !== "loaded") return fail(409, "not_in_transit");
      return apply("delivered", "delivered");
    case "cancel":
      if (!isOwner && !isAdmin) return forbidden;
      if (status !== "pending" && status !== "assigned") return fail(409, "cannot_cancel");
      return apply("cancelled", "cancelled");
  }
}

export interface TransporterProfile {
  id: string;
  role: Role;
  disabled?: boolean;
  vehicleCategories?: VehicleCategory[];
  workZones?: Zone[];
}

// Catégories d'un transporteur : celles de son profil + celles de ses camions publiés.
export function transporterCategories(profile: TransporterProfile, truckCategories: VehicleCategory[] = []): Set<VehicleCategory> {
  return new Set([...(profile.vehicleCategories ?? []), ...truckCategories]);
}

// Une mission n'est proposée qu'aux transporteurs du bon type de véhicule ET de la bonne région de chargement.
export function matchesTransporter(
  mission: Pick<MissionCore, "status"> & Pick<MissionFacts, "vehicleCategory" | "pickupZone">,
  profile: TransporterProfile,
  truckCategories: VehicleCategory[] = [],
): boolean {
  if (profile.role !== "transporter" || profile.disabled || mission.status !== "pending") return false;
  if (!profile.workZones?.includes(mission.pickupZone)) return false;
  const categories = transporterCategories(profile, truckCategories);
  return mission.vehicleCategory === "any" ? categories.size > 0 : categories.has(mission.vehicleCategory);
}

export interface MissionFilters {
  from?: string; // YYYY-MM-DD, inclus
  to?: string; // YYYY-MM-DD, inclus
  status?: MissionStatus;
  productType?: ProductType;
  pickupZone?: Zone;
  dropoffZone?: Zone;
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function filterMissions<T extends Pick<MissionCore, "status"> & MissionFacts>(missions: T[], filters: MissionFilters): T[] {
  return missions.filter((mission) => {
    const created = day(mission.createdAt);
    return (!filters.from || created >= filters.from)
      && (!filters.to || created <= filters.to)
      && (!filters.status || mission.status === filters.status)
      && (!filters.productType || mission.productType === filters.productType)
      && (!filters.pickupZone || mission.pickupZone === filters.pickupZone)
      && (!filters.dropoffZone || mission.dropoffZone === filters.dropoffZone);
  });
}

export interface MissionStats {
  missions: number;
  delivered: number;
  tonnes: number;
  activeTransporters: number;
  topRoutes: { route: string; count: number }[];
}

// Indicateurs d'un mois (YYYY-MM) : missions non annulées ; tonnes = missions livrées.
export function missionStats(missions: (Pick<MissionCore, "status" | "transporterId"> & MissionFacts)[], month: string): MissionStats {
  const inMonth = missions.filter((mission) => day(mission.createdAt).startsWith(month) && mission.status !== "cancelled");
  const delivered = inMonth.filter((mission) => mission.status === "delivered");
  const routes = new Map<string, number>();
  for (const mission of inMonth) {
    const route = `${zoneLabels[mission.pickupZone]} → ${zoneLabels[mission.dropoffZone]}`;
    routes.set(route, (routes.get(route) ?? 0) + 1);
  }
  return {
    missions: inMonth.length,
    delivered: delivered.length,
    tonnes: Number((delivered.reduce((total, mission) => total + (mission.quantityKg ?? 0), 0) / 1000).toFixed(1)),
    activeTransporters: new Set(inMonth.map((mission) => mission.transporterId).filter(Boolean)).size,
    topRoutes: [...routes].map(([route, count]) => ({ route, count })).sort((a, b) => b.count - a.count).slice(0, 5),
  };
}

// CSV pour Excel en français/portugais : « ; » et BOM UTF-8 ; cellules échappées.
export function toCsv(rows: (string | number | undefined | null)[][]): string {
  const cell = (value: string | number | undefined | null) => {
    const text = value === undefined || value === null ? "" : String(value);
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `\uFEFF${rows.map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}
