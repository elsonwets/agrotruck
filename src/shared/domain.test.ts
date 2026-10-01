import { describe, expect, it } from "vitest";
import { formatPhone, isValidPhone, localPhone, normalizePhone } from "./domain";
import { nearestZone } from "./zones";

describe("phone numbers", () => {
  it("adds the Bissau dialling code to local numbers only", () => {
    expect(normalizePhone("955 00 00 00")).toBe("245955000000");
    expect(normalizePhone("+245 955 00 00 00")).toBe("245955000000");
    expect(normalizePhone("00245955000000")).toBe("245955000000");
    expect(normalizePhone("245955000000")).toBe("245955000000");
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("33612345678");
    expect(formatPhone("955-000-000")).toBe("+245955000000");
    expect(localPhone("+245955000000")).toBe("955000000");
    expect(localPhone("+33612345678")).toBe("+33612345678");
  });

  it("rejects numbers that are too short or not numbers", () => {
    expect(isValidPhone("955000000")).toBe(true);
    expect(isValidPhone("+33612345678")).toBe(true);
    expect(isValidPhone("12")).toBe(false);
    expect(isValidPhone("abc")).toBe(false);
  });
});

describe("nearestZone", () => {
  it("guesses the region of a GPS position", () => {
    expect(nearestZone(11.8636, -15.5977)).toBe("bissau"); // Bissau
    expect(nearestZone(12.2833, -14.2167)).toBe("gabu"); // Gabú
    expect(nearestZone(12.1667, -14.6667)).toBe("bafata"); // Bafatá
    expect(nearestZone(11.2833, -15.25)).toBe("tombali"); // Catió
  });
});
