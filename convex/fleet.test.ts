/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

type T = ReturnType<typeof convexTest>;

async function signup(t: T, role: "producer" | "transporter", phone: string, extra: Record<string, unknown> = {}) {
  const result = await t.mutation(api.auth.signup, { role, phone, pin: "1234", displayName: `${role} ${phone}`, ...extra });
  if (!result.ok) throw new Error(result.error);
  return result.token;
}

const truckInput = {
  category: "camion" as const, listingMode: "transport" as const, capacityTons: 20, zone: "gabu" as const, location: "Gabú",
  serviceZones: [], goods: [], availability: "available" as const, description: "", photoIds: [],
};

function addTruck(t: T, token: string, name: string, extra: Record<string, unknown> = {}) {
  return t.mutation(api.trucks.create, { token, ...truckInput, name, ...extra });
}

describe("trucks", () => {
  it("stores the licence plate in capitals", async () => {
    const t = convexTest(schema, modules);
    const owner = await signup(t, "transporter", "+245955000800");
    await addTruck(t, owner, "Actros", { plate: " ab-123-cd " });
    const [truck] = await t.query(api.trucks.mine, { token: owner });
    expect(truck.plate).toBe("AB-123-CD");
  });
});
