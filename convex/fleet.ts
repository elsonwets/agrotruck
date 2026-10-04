import { v } from "convex/values";
import { query } from "./_generated/server";
import { displayStatus, firstName, progress } from "../src/shared/fleet";
import { currentMission, isFleetOwner, latestPosition, requireFleetOwner } from "./lib/fleet";
import { getSessionUser } from "./lib/session";
import { card, visibleOwner } from "./trucks";

// Vues de la flotte : tableau de bord du transporteur Pro, et liste publique « Camions en direct » (sans position).

const PUBLIC_SIZE = 60;

// Les onglets « Ma flotte » et « Conducteurs » ne s'affichent que pour un transporteur avec 2 véhicules ou plus.
export const access = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await getSessionUser(ctx, token);
    return { fleet: Boolean(user && user.role === "transporter" && (await isFleetOwner(ctx, user._id))) };
  },
});

export const overview = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user = await requireFleetOwner(ctx, token);
    const trucks = await ctx.db.query("trucks").withIndex("by_ownerId", (q) => q.eq("ownerId", user._id)).take(100);
    return Promise.all(trucks.map(async (truck) => {
      const mission = await currentMission(ctx, truck._id);
      const position = await latestPosition(ctx, truck._id);
      const driver = truck.driverId ? await ctx.db.get("drivers", truck.driverId) : null;
      return {
        _id: truck._id,
        name: truck.name,
        plate: truck.plate ?? null,
        category: truck.category,
        capacityTons: truck.capacityTons,
        photoUrl: truck.photoIds[0] ? await ctx.storage.getUrl(truck.photoIds[0]) : null,
        status: displayStatus(truck.availability, mission?.status ?? null),
        driver: driver ? { _id: driver._id, name: driver.name, phone: driver.phone } : null,
        position: position ? { lat: position.lat, lng: position.lng, accuracy: position.accuracy ?? null, at: position.at } : null,
        mission: mission ? { _id: mission._id, pickupZone: mission.pickupZone, dropoffZone: mission.dropoffZone } : null,
        progress: mission ? progress(mission.pickupZone, mission.dropoffZone, mission.status, position) : null,
      };
    }));
  },
});

// Liste publique : statut, prénom du conducteur et progression arrondie. Jamais de coordonnées ni de téléphone.
export const publicList = query({
  args: {},
  handler: async (ctx) => {
    const trucks = await ctx.db.query("trucks").withIndex("by_hidden", (q) => q.eq("hidden", false)).order("desc").take(300);
    const cards = [];
    for (const truck of trucks) {
      if (cards.length >= PUBLIC_SIZE) break;
      const owner = await visibleOwner(ctx, truck);
      if (!owner) continue;
      const mission = await currentMission(ctx, truck._id);
      const position = mission?.status === "loaded" ? await latestPosition(ctx, truck._id) : null;
      const driver = truck.driverId ? await ctx.db.get("drivers", truck.driverId) : null;
      cards.push({
        ...(await card(ctx, truck, owner)),
        plate: truck.plate ?? null,
        status: displayStatus(truck.availability, mission?.status ?? null),
        driverName: driver && !driver.disabled ? firstName(driver.name) : null,
        route: mission ? { pickupZone: mission.pickupZone, dropoffZone: mission.dropoffZone } : null,
        // Arrondie à 5 % : on ne peut pas en déduire une position précise.
        progress: mission ? Math.round(progress(mission.pickupZone, mission.dropoffZone, mission.status, position) * 20) / 20 : null,
      });
    }
    return cards;
  },
});
