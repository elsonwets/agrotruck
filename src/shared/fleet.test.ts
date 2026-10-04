import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_MS, checkFix, displayStatus, distanceMeters, escapeHtml, firstName, isStale, progress, shouldSend, whatsappUrl, zoneCenter,
} from "./fleet";

const gabu = zoneCenter("gabu");
const bissau = zoneCenter("bissau");

describe("distanceMeters", () => {
  it("measures Bissau → Gabú at about 157 km", () => {
    const distance = distanceMeters(bissau, gabu);
    expect(distance).toBeGreaterThan(140_000);
    expect(distance).toBeLessThan(175_000);
    expect(distanceMeters(bissau, bissau)).toBe(0);
  });
});

describe("progress", () => {
  it("follows the distance already covered once the truck is loaded", () => {
    const halfway = { lat: (gabu.lat + bissau.lat) / 2, lng: (gabu.lng + bissau.lng) / 2 };
    expect(progress("gabu", "bissau", "loaded", gabu)).toBeCloseTo(0, 2);
    expect(progress("gabu", "bissau", "loaded", halfway)).toBeCloseTo(0.5, 1);
    expect(progress("gabu", "bissau", "loaded", bissau)).toBeCloseTo(1, 2);
  });

  it("stays between 0 and 1 when the truck is off the straight line", () => {
    expect(progress("gabu", "bissau", "loaded", { lat: 12.28, lng: -13.0 })).toBe(0);
  });

  it("falls back to the mission steps without a usable position", () => {
    expect(progress("bissau", "bissau", "loaded", bissau)).toBe(0.5);
    expect(progress("gabu", "bissau", "loaded", null)).toBe(0.5);
    expect(progress("gabu", "bissau", "assigned", gabu)).toBe(0);
    expect(progress("gabu", "bissau", "delivered", null)).toBe(1);
  });
});

describe("displayStatus", () => {
  it("puts the ongoing mission before the vehicle availability", () => {
    expect(displayStatus("maintenance", "loaded")).toBe("on_route");
    expect(displayStatus("available", "assigned")).toBe("loading");
    expect(displayStatus("maintenance", null)).toBe("maintenance");
    expect(displayStatus("in_transit", null)).toBe("available");
  });
});

describe("shouldSend", () => {
  const start = { lat: 12, lng: -15, at: 1_000_000 };
  it("sends the first point, then every 30 s or every 100 m", () => {
    expect(shouldSend(null, start)).toBe(true);
    expect(shouldSend(start, { lat: 12.00018, lng: -15, at: start.at + 10_000 })).toBe(false); // ~20 m, 10 s
    expect(shouldSend(start, { lat: 12, lng: -15, at: start.at + 30_000 })).toBe(true);
    expect(shouldSend(start, { lat: 12.00135, lng: -15, at: start.at + 10_000 })).toBe(true); // ~150 m
  });
});

describe("checkFix", () => {
  it("rejects impossible coordinates and ignores imprecise ones", () => {
    expect(checkFix({ lat: 12, lng: -15, accuracy: 20 })).toBe("ok");
    expect(checkFix({ lat: 12, lng: -15 })).toBe("ok");
    expect(checkFix({ lat: 91, lng: -15 })).toBe("invalid");
    expect(checkFix({ lat: Number.NaN, lng: -15 })).toBe("invalid");
    expect(checkFix({ lat: 12, lng: -15, accuracy: -1 })).toBe("invalid");
    expect(checkFix({ lat: 12, lng: -15, accuracy: 1500 })).toBe("imprecise");
  });
});

describe("helpers", () => {
  it("detects a lost signal after 10 minutes", () => {
    expect(isStale(0, STALE_AFTER_MS + 1)).toBe(true);
    expect(isStale(0, 60_000)).toBe(false);
  });

  it("keeps only the first name", () => {
    expect(firstName("  Mamadu  Baldé ")).toBe("Mamadu");
  });

  it("builds a wa.me link from a phone typed with spaces and +", () => {
    expect(whatsappUrl("+245 955 000 701", "Olá & bem-vindo")).toBe("https://wa.me/245955000701?text=Ol%C3%A1%20%26%20bem-vindo");
  });

  it("escapes HTML for the map popups", () => {
    expect(escapeHtml(`<b>"A&B"</b>'`)).toBe("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;&#39;");
  });
});
