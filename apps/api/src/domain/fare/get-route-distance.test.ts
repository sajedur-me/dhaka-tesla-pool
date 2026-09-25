import { describe, expect, it } from "vitest";

import { getRouteDistance } from "./get-route-distance.js";

describe("getRouteDistance", () => {
  it("returns the configured distance for Banani to Mohakhali", () => {
    expect(
      getRouteDistance({
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
      }),
    ).toBe(3);
  });

  it("returns the configured distance for Banani to Gulshan 1", () => {
    expect(
      getRouteDistance({
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
      }),
    ).toBe(4);
  });

  it("rejects the same pickup and destination", () => {
    expect(() =>
      getRouteDistance({
        pickupZone: "BANANI",
        destinationZone: "BANANI",
      }),
    ).toThrow("Pickup and destination must be different");
  });

  it("rejects an unsupported route", () => {
    expect(() =>
      getRouteDistance({
        pickupZone: "DHANMONDI",
        destinationZone: "UTTARA",
      }),
    ).toThrow("Unsupported route: DHANMONDI -> UTTARA");
  });
});
