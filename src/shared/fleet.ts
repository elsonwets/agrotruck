import type { Availability, MissionStatus } from "./domain";
import { zones, type Zone } from "./zones";

// Règles de la gestion de flotte et du suivi GPS, partagées par le navigateur et Convex.

export const FLEET_MIN_TRUCKS = 2; // la flotte s'active dès 2 véhicules
export const SEND_INTERVAL_MS = 30_000; // le téléphone envoie au plus toutes les 30 s…
export const SEND_DISTANCE_M = 100; // … ou dès qu'il a bougé de 100 m
export const SERVER_MIN_INTERVAL_MS = 10_000; // le serveur garde au plus un point toutes les 10 s par camion
export const MAX_ACCURACY_M = 1_000; // un point moins précis est ignoré
export const STALE_AFTER_MS = 10 * 60_000; // au-delà : « signal perdu »
export const LINK_TTL_MS = 7 * 24 * 60 * 60_000; // durée d'un lien de suivi

export interface LatLng { lat: number; lng: number }
export interface Fix extends LatLng { at: number }

const EARTH_RADIUS_M = 6_371_000;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

// Distance à vol d'oiseau (haversine).
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function zoneCenter(zone: Zone): LatLng {
  const found = zones.find((entry) => entry.id === zone) ?? zones[0];
  return { lat: found.lat, lng: found.lng };
}

export const DISPLAY_STATUSES = ["available", "loading", "on_route", "maintenance"] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

// Statut montré sur les cartes : la mission en cours passe avant la disponibilité déclarée du véhicule.
export function displayStatus(availability: Availability, missionStatus: MissionStatus | null): DisplayStatus {
  if (missionStatus === "loaded") return "on_route";
  if (missionStatus === "assigned") return "loading";
  return availability === "maintenance" ? "maintenance" : "available";
}

const STEP_PROGRESS: Record<MissionStatus, number> = { pending: 0, assigned: 0, loaded: 0.5, delivered: 1, cancelled: 0 };

// Part du trajet faite, entre le chef-lieu de la zone de départ et celui de la zone d'arrivée.
// Sans position, ou dans une même région, la barre suit simplement les étapes de la mission.
export function progress(pickup: Zone, dropoff: Zone, status: MissionStatus, position: LatLng | null): number {
  if (status !== "loaded" || !position || pickup === dropoff) return STEP_PROGRESS[status];
  const end = zoneCenter(dropoff);
  const total = distanceMeters(zoneCenter(pickup), end);
  return Math.min(1, Math.max(0, 1 - distanceMeters(position, end) / total));
}

export function shouldSend(last: Fix | null, next: Fix): boolean {
  return !last || next.at - last.at >= SEND_INTERVAL_MS || distanceMeters(last, next) >= SEND_DISTANCE_M;
}

export type FixCheck = "ok" | "invalid" | "imprecise";

export function checkFix(fix: { lat: number; lng: number; accuracy?: number }): FixCheck {
  const valid = Number.isFinite(fix.lat) && Number.isFinite(fix.lng) && Math.abs(fix.lat) <= 90 && Math.abs(fix.lng) <= 180
    && (fix.accuracy === undefined || (Number.isFinite(fix.accuracy) && fix.accuracy >= 0));
  if (!valid) return "invalid";
  return fix.accuracy !== undefined && fix.accuracy > MAX_ACCURACY_M ? "imprecise" : "ok";
}

export const isStale = (at: number, now: number) => now - at > STALE_AFTER_MS;

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Les bulles Leaflet prennent du HTML : tout texte saisi par un utilisateur passe par ici.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}
