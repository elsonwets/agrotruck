import { describe, expect, it } from "vitest";
import { isValidPrice, sortOffers } from "./offers";

describe("offers", () => {
  it("accepts only positive whole prices within bounds", () => {
    expect(isValidPrice(150_000)).toBe(true);
    expect(isValidPrice(0)).toBe(false);
    expect(isValidPrice(-5)).toBe(false);
    expect(isValidPrice(1500.5)).toBe(false);
    expect(isValidPrice(60_000_000)).toBe(false);
  });

  it("lists the accepted offer first, then pending offers from the cheapest", () => {
    const offers = [
      { id: "a", status: "pending" as const, price: 200_000, updatedAt: 1 },
      { id: "b", status: "declined" as const, price: 90_000, updatedAt: 1 },
      { id: "c", status: "pending" as const, price: 150_000, updatedAt: 2 },
      { id: "d", status: "accepted" as const, price: 180_000, updatedAt: 3 },
      { id: "e", status: "pending" as const, price: 150_000, updatedAt: 1 },
    ];
    expect(sortOffers(offers).map((offer) => offer.id)).toEqual(["d", "e", "c", "a", "b"]);
  });
});
