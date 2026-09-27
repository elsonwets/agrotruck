import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { normalizePhone, PIN_PATTERN } from "../src/shared/domain";
import { hashPassword } from "./lib/security";
import { publicUser, requireUser } from "./lib/session";
import { vCategory, vLang, vRole, vZone } from "./lib/validators";

const text = (value: string | undefined, max: number) => (value === undefined ? undefined : value.trim().slice(0, max));

export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => publicUser(await requireUser(ctx, token)),
});

// Champs modifiables selon le rôle : un producteur ne peut pas se donner des régions de transporteur, et inversement.
export const updateProfile = mutation({
  args: {
    token: v.string(),
    displayName: v.optional(v.string()),
    phone: v.optional(v.string()),
    companyName: v.optional(v.string()),
    lang: v.optional(vLang),
    vehicleCategories: v.optional(v.array(vCategory)),
    capacityTons: v.optional(v.number()),
    workZones: v.optional(v.array(vZone)),
    mainZone: v.optional(v.union(vZone, v.null())),
    mainLocation: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...input }) => {
    const user = await requireUser(ctx, token);
    const patch: Partial<typeof user> = { updatedAt: Date.now() };
    if (input.displayName !== undefined) {
      const name = text(input.displayName, 80);
      if (!name) throw new ConvexError({ code: "invalid_name" });
      patch.displayName = name;
    }
    if (input.phone !== undefined && normalizePhone(input.phone) !== user.phoneKey) {
      if (!/^\+?[\d\s-]{7,20}$/.test(input.phone.trim())) throw new ConvexError({ code: "invalid_phone" });
      const taken = await ctx.db.query("users").withIndex("by_phoneKey", (q) => q.eq("phoneKey", normalizePhone(input.phone!))).unique();
      if (taken) throw new ConvexError({ code: "phone_taken" });
      patch.phone = input.phone.trim();
      patch.phoneKey = normalizePhone(input.phone);
    }
    if (input.companyName !== undefined) patch.companyName = text(input.companyName, 80) || undefined;
    if (input.lang !== undefined) patch.lang = input.lang;
    if (user.role === "transporter") {
      if (input.vehicleCategories !== undefined) patch.vehicleCategories = [...new Set(input.vehicleCategories)];
      if (input.workZones !== undefined) patch.workZones = [...new Set(input.workZones)];
      if (input.capacityTons !== undefined) patch.capacityTons = Math.max(0, input.capacityTons);
    }
    if (user.role === "producer") {
      if (input.mainZone !== undefined) patch.mainZone = input.mainZone ?? undefined;
      if (input.mainLocation !== undefined) patch.mainLocation = text(input.mainLocation, 120) || undefined;
    }
    await ctx.db.patch("users", user._id, patch);
    return publicUser({ ...user, ...patch });
  },
});

// --- Administration ---

export const list = query({
  args: { token: v.string(), role: v.optional(vRole) },
  handler: async (ctx, { token, role }) => {
    await requireUser(ctx, token, ["admin"]);
    const users = role
      ? await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", role)).take(500)
      : await ctx.db.query("users").order("desc").take(500);
    return users.map(publicUser);
  },
});

export const setDisabled = mutation({
  args: { token: v.string(), userId: v.id("users"), disabled: v.boolean() },
  handler: async (ctx, { token, userId, disabled }) => {
    const admin = await requireUser(ctx, token, ["admin"]);
    if (admin._id === userId) throw new ConvexError({ code: "cannot_block_self" });
    const user = await ctx.db.get("users", userId);
    if (!user) throw new ConvexError({ code: "not_found" });
    await ctx.db.patch("users", userId, { disabled, updatedAt: Date.now() });
    if (disabled) {
      // Déconnexion immédiate sur tous les appareils.
      const sessions = await ctx.db.query("sessions").withIndex("by_userId", (q) => q.eq("userId", userId)).take(100);
      for (const session of sessions) await ctx.db.delete("sessions", session._id);
    }
    return null;
  },
});

export const resetPin = mutation({
  args: { token: v.string(), userId: v.id("users"), pin: v.string() },
  handler: async (ctx, { token, userId, pin }) => {
    await requireUser(ctx, token, ["admin"]);
    if (!PIN_PATTERN.test(pin)) throw new ConvexError({ code: "invalid_pin" });
    if (!(await ctx.db.get("users", userId))) throw new ConvexError({ code: "not_found" });
    await ctx.db.patch("users", userId, { passwordHash: await hashPassword(pin), updatedAt: Date.now() });
    return null;
  },
});

// Premier compte admin : `npx convex run users:bootstrapAdmin '{"phone":"...","pin":"...","displayName":"..."}'`.
// Refusé dès qu'un admin existe (les suivants sont promus depuis la base par un admin existant).
export const bootstrapAdmin = internalMutation({
  args: { phone: v.string(), pin: v.string(), displayName: v.string() },
  handler: async (ctx, { phone, pin, displayName }) => {
    if (await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "admin")).first()) throw new ConvexError({ code: "admin_exists" });
    if (!PIN_PATTERN.test(pin)) throw new ConvexError({ code: "invalid_pin" });
    if (await ctx.db.query("users").withIndex("by_phoneKey", (q) => q.eq("phoneKey", normalizePhone(phone))).unique()) {
      throw new ConvexError({ code: "phone_taken" });
    }
    return ctx.db.insert("users", {
      phone: phone.trim(), phoneKey: normalizePhone(phone), passwordHash: await hashPassword(pin), role: "admin", displayName: displayName.trim(),
    });
  },
});
