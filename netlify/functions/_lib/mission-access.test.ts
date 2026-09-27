import { describe, expect, it } from "vitest";
import { canViewOrder, findOrderById, missionForViewer, saveOrder, transition, transporterContact, updateOrderIfUnchanged } from "./orders";
import { fakeStore } from "./test-store";
import type { Account } from "../../../types/account";
import type { Order } from "../../../types/order";

const order = { id: "o1", producerAccountId: "prod-1", transporterAccountId: "tr-1" } as Order;
const transporter = { id: "tr-1", phone: "+245955000200", displayName: "Mamadu", role: "partner" } as Account;

describe("canViewOrder", () => {
  it("lets the producer who created it, the assigned transporter and Badora see a mission", () => {
    expect(canViewOrder(order, { accountId: "prod-1", role: "producer" })).toBe(true);
    expect(canViewOrder(order, { accountId: "tr-1", role: "partner" })).toBe(true);
    expect(canViewOrder(order, { accountId: "adm", role: "admin" })).toBe(true);
  });

  it("hides it from other producers and other transporters", () => {
    expect(canViewOrder(order, { accountId: "prod-2", role: "producer" })).toBe(false);
    expect(canViewOrder(order, { accountId: "tr-2", role: "partner" })).toBe(false);
  });
});

describe("transporterContact", () => {
  it("shows the transporter's company when there is one, with the transporter's own number", () => {
    expect(transporterContact({ ...transporter, companyName: "Transportes Djaló" })).toEqual({ name: "Transportes Djaló", phone: "+245955000200" });
  });

  it("falls back to the transporter's name", () => {
    expect(transporterContact(transporter)).toEqual({ name: "Mamadu", phone: "+245955000200" });
  });

  it("returns null when no transporter is assigned", () => {
    expect(transporterContact(null)).toBeNull();
  });
});

describe("missionForViewer", () => {
  const full = { ...order, status: "pending", clientName: "Coop Pirada", clientPhone: "+245955000300" } as Order;

  it("hides the producer's phone from a transporter who has not accepted the mission", () => {
    const view = missionForViewer({ ...full, transporterAccountId: undefined }, { accountId: "tr-2", role: "partner" });
    expect(view).not.toHaveProperty("clientPhone");
    expect(view.clientName).toBe("Coop Pirada");
  });

  it("shows the producer's phone to the assigned transporter, the producer and Badora", () => {
    expect(missionForViewer(full, { accountId: "tr-1", role: "partner" }).clientPhone).toBe("+245955000300");
    expect(missionForViewer(full, { accountId: "prod-1", role: "producer" }).clientPhone).toBe("+245955000300");
    expect(missionForViewer(full, { accountId: "adm", role: "admin" }).clientPhone).toBe("+245955000300");
  });
});

describe("updateOrderIfUnchanged", () => {
  const pending = { id: "o9", status: "pending", events: [] } as unknown as Order;
  const first = { accountId: "tr-1", role: "partner" as const };
  const second = { accountId: "tr-2", role: "partner" as const };

  it("applies and saves a transition", async () => {
    const store = fakeStore();
    await saveOrder(pending, store);
    const result = await updateOrderIfUnchanged("o9", (current) => transition(current, "accept", first), store);
    expect(result?.ok).toBe(true);
    expect((await findOrderById("o9", store))?.transporterAccountId).toBe("tr-1");
  });

  it("re-checks against the latest version when another transporter accepted in the meantime", async () => {
    const store = fakeStore();
    await saveOrder(pending, store);
    let raced = false;
    const result = await updateOrderIfUnchanged("o9", (current) => {
      if (!raced) {
        raced = true; // un autre transporteur accepte entre notre lecture et notre écriture
        const other = transition(current, "accept", first);
        if (other.ok) void saveOrder(other.order, store);
      }
      return transition(current, "accept", second);
    }, store);
    expect(result).toEqual({ ok: false, status: 409, error: "Mission déjà prise" });
    expect((await findOrderById("o9", store))?.transporterAccountId).toBe("tr-1");
  });

  it("returns null for an unknown mission", async () => {
    expect(await updateOrderIfUnchanged("missing", (current) => transition(current, "accept", first), fakeStore())).toBeNull();
  });
});
