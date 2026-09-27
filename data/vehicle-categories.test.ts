import { describe, expect, it } from "vitest";
import { categoryOfTruckType, vehicleCategories } from "./vehicle-categories";
import { truckTypeLabels, type TruckType } from "../types/truck";

// Types du catalogue volontairement sans catégorie de mission (engins de chantier, voyageurs).
const withoutCategory: TruckType[] = [
  "crane", "loader", "road_machine", "private_taxi", "shared_taxi", "seven_seater",
  "toca_toca", "minibus", "candonga", "coach", "suv", "chauffeur_car",
];

describe("vehicle categories", () => {
  it("lists the truck first, in the familiar order", () => {
    expect(vehicleCategories.map(({ id }) => id)).toEqual(["camion", "camionnette", "moto_tricycle", "tracteur", "semi_remorque"]);
  });

  it("maps every catalogue type to exactly one category, except the explicit exclusions", () => {
    for (const type of Object.keys(truckTypeLabels) as TruckType[]) {
      const matches = vehicleCategories.filter((category) => category.truckTypes.includes(type));
      expect(matches.length, type).toBe(withoutCategory.includes(type) ? 0 : 1);
    }
  });

  it("finds the category of a catalogue type", () => {
    expect(categoryOfTruckType("dump_truck")).toBe("camion");
    expect(categoryOfTruckType("pickup")).toBe("camionnette");
    expect(categoryOfTruckType("cargo_tricycle")).toBe("moto_tricycle");
    expect(categoryOfTruckType("minibus")).toBeNull();
  });
});
