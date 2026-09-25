import { describe, expect, it } from "vitest";

import { calculateFare } from "./calculate-fare.js";

describe("calculateFare", () => {
  it("calculates a solo passenger fare", () => {
    const farePoisha = calculateFare({
      distanceKm: 3,
      isPooled: false,
    });

    expect(farePoisha).toBe(11_000);
  });

  it("applies the pool discount to a pooled passenger fare", () => {
    const farePoisha = calculateFare({
      distanceKm: 3,
      isPooled: true,
    });

    expect(farePoisha).toBe(8_800);
  });

  it("rejects a zero distance", () => {
    expect(() =>
      calculateFare({
        distanceKm: 0,
        isPooled: false,
      }),
    ).toThrow("Distance must be greater than zero");
  });

  it("rejects a negative distance", () => {
    expect(() =>
      calculateFare({
        distanceKm: -1,
        isPooled: true,
      }),
    ).toThrow("Distance must be greater than zero");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects a non-finite distance: %s",
    (distanceKm) => {
      expect(() =>
        calculateFare({
          distanceKm,
          isPooled: false,
        }),
      ).toThrow("Distance must be greater than zero");
    },
  );
});
