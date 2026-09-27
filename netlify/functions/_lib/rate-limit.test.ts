import { describe, expect, it, beforeEach } from "vitest";
import { clearAttempts, isLocked, recordAttempt } from "./rate-limit";
import type { BlobStore } from "./accounts";
import { fakeStore } from "./test-store";


const limit = { max: 5, windowMinutes: 15, lockMinutes: 15 };
const minute = 60_000;
const start = Date.parse("2026-10-01T08:00:00.000Z");

describe("rate limit", () => {
  let store: BlobStore;
  beforeEach(() => { store = fakeStore(); });

  it("locks a key after the maximum number of attempts, then unlocks it after the lock period", async () => {
    for (let attempt = 0; attempt < 4; attempt++) await recordAttempt("login/1", limit, store, start + attempt * minute);
    expect(await isLocked("login/1", store, start + 4 * minute)).toBe(false);
    await recordAttempt("login/1", limit, store, start + 4 * minute);
    expect(await isLocked("login/1", store, start + 5 * minute)).toBe(true);
    expect(await isLocked("login/1", store, start + 20 * minute)).toBe(false);
  });

  it("forgets attempts older than the window", async () => {
    for (let attempt = 0; attempt < 4; attempt++) await recordAttempt("login/2", limit, store, start);
    await recordAttempt("login/2", limit, store, start + 16 * minute);
    expect(await isLocked("login/2", store, start + 16 * minute)).toBe(false);
  });

  it("clears attempts after a success", async () => {
    for (let attempt = 0; attempt < 4; attempt++) await recordAttempt("login/3", limit, store, start);
    await clearAttempts("login/3", store);
    await recordAttempt("login/3", limit, store, start);
    expect(await isLocked("login/3", store, start)).toBe(false);
  });

  it("keeps keys independent", async () => {
    for (let attempt = 0; attempt < 5; attempt++) await recordAttempt("login/4", limit, store, start);
    expect(await isLocked("login/5", store, start)).toBe(false);
  });
});
