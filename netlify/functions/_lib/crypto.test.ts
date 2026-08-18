import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, signSession, verifySession } from "./crypto";

describe("password hashing", () => {
  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("produces a different hash for the same password each time (random salt)", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("session tokens", () => {
  const payload = { accountId: "acc-1", role: "admin" as const, displayName: "Badora" };

  it("round-trips a signed session", () => {
    const token = signSession(payload);
    expect(verifySession(token)).toEqual(payload);
  });

  it("rejects a tampered token", () => {
    const token = signSession(payload);
    const tampered = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a");
    expect(verifySession(tampered)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(verifySession("not-a-real-token")).toBeNull();
  });
});
