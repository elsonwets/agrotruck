import { describe, expect, it } from "vitest";
import { sessionCookieHeader, clearSessionCookieHeader, getSessionFromRequest, SESSION_COOKIE_NAME } from "./session";

const payload = { accountId: "acc-1", role: "admin" as const, displayName: "Badora" };

describe("session cookies", () => {
  it("round-trips a session through a Set-Cookie header and a Cookie request header", () => {
    const setCookie = sessionCookieHeader(payload);
    const token = setCookie.split(";")[0].split("=")[1];
    const request = new Request("https://example.com", { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } });
    expect(getSessionFromRequest(request)).toEqual(payload);
  });

  it("returns null when there is no cookie", () => {
    expect(getSessionFromRequest(new Request("https://example.com"))).toBeNull();
  });

  it("returns null for an unrelated cookie", () => {
    const request = new Request("https://example.com", { headers: { Cookie: "other=value" } });
    expect(getSessionFromRequest(request)).toBeNull();
  });

  it("clearSessionCookieHeader expires the cookie immediately", () => {
    expect(clearSessionCookieHeader()).toContain("Max-Age=0");
  });
});
