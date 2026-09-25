import { describe, expect, it } from "vitest";

import { canAccommodateSeats } from "./can-accommodate-seats.js";

describe("canAccommodateSeats", () => {
  it("allows a passenger when Bullet has enough seats", () => {
    expect(
      canAccommodateSeats({
        vehicleCapacity: 3,
        occupiedSeats: 1,
        requestedSeats: 1,
      }),
    ).toBe(true);
  });

  it("allows a booking that fills Bullet exactly to capacity", () => {
    expect(
      canAccommodateSeats({
        vehicleCapacity: 3,
        occupiedSeats: 2,
        requestedSeats: 1,
      }),
    ).toBe(true);
  });

  it("rejects a booking that would exceed Bullet's capacity", () => {
    expect(
      canAccommodateSeats({
        vehicleCapacity: 3,
        occupiedSeats: 2,
        requestedSeats: 2,
      }),
    ).toBe(false);
  });

  it("rejects a booking when Bullet is already full", () => {
    expect(
      canAccommodateSeats({
        vehicleCapacity: 3,
        occupiedSeats: 3,
        requestedSeats: 1,
      }),
    ).toBe(false);
  });

  it.each([
    {
      vehicleCapacity: 0,
      occupiedSeats: 0,
      requestedSeats: 1,
    },
    {
      vehicleCapacity: 3,
      occupiedSeats: -1,
      requestedSeats: 1,
    },
    {
      vehicleCapacity: 3,
      occupiedSeats: 1,
      requestedSeats: 0,
    },
    {
      vehicleCapacity: 3,
      occupiedSeats: 4,
      requestedSeats: 1,
    },
    {
      vehicleCapacity: 3,
      occupiedSeats: 1.5,
      requestedSeats: 1,
    },
  ])("rejects invalid capacity input: %o", (input) => {
    expect(canAccommodateSeats(input)).toBe(false);
  });
});
