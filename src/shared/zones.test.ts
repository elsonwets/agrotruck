import { describe, expect, it } from "vitest";
import { isZone, zoneLabels, zones } from "./zones";

describe("zones", () => {
  it("lists the regions of Guinea-Bissau", () => {
    expect(zones).toHaveLength(9);
    expect(zoneLabels.gabu).toBe("Gabú");
  });

  it("recognises only known zone ids", () => {
    expect(isZone("bafata")).toBe(true);
    expect(isZone("Gabu")).toBe(false);
    expect(isZone(undefined)).toBe(false);
  });
});
