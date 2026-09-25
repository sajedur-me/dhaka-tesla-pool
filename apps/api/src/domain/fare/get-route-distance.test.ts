import { describe, expect, it } from "vitest";

import { DHAKA_CORRIDORS } from "../pooling/dhaka-corridors.js";
import {
  getRouteDistance,
  ROUTE_DISTANCES_KM,
} from "./get-route-distance.js";

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

  it("supports every downstream route defined by the pooling corridors", () => {
    for (const corridor of DHAKA_CORRIDORS) {
      for (
        let pickupIndex = 0;
        pickupIndex < corridor.length - 1;
        pickupIndex += 1
      ) {
        for (
          let destinationIndex = pickupIndex + 1;
          destinationIndex < corridor.length;
          destinationIndex += 1
        ) {
          const pickupZone = corridor[pickupIndex];
          const destinationZone = corridor[destinationIndex];

          if (!pickupZone || !destinationZone) {
            throw new Error("Invalid corridor configuration");
          }

          const routeKey =
            `${pickupZone}:${destinationZone}` as keyof typeof ROUTE_DISTANCES_KM;

          expect(
            ROUTE_DISTANCES_KM[routeKey],
            `Missing distance for ${pickupZone} -> ${destinationZone}`,
          ).toBeGreaterThan(0);

          expect(
            getRouteDistance({
              pickupZone,
              destinationZone,
            }),
          ).toBe(ROUTE_DISTANCES_KM[routeKey]);
        }
      }
    }
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
