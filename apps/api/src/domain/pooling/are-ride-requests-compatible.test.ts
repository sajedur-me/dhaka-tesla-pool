import { describe, expect, it } from "vitest";

import { areRideRequestsCompatible } from "./are-ride-requests-compatible.js";

describe("areRideRequestsCompatible", () => {
  it("matches Nusrat and Rafiq on the shared Banani corridor", () => {
    const nusratRequest = {
      pickupZone: "BANANI",
      destinationZone: "MOHAKHALI",
    } as const;

    const rafiqRequest = {
      pickupZone: "BANANI",
      destinationZone: "GULSHAN_1",
    } as const;

    expect(
      areRideRequestsCompatible(nusratRequest, rafiqRequest),
    ).toBe(true);
  });

  it("matches passengers travelling to the same downstream destination", () => {
    expect(
      areRideRequestsCompatible(
        {
          pickupZone: "BANANI",
          destinationZone: "GULSHAN_1",
        },
        {
          pickupZone: "BANANI",
          destinationZone: "GULSHAN_1",
        },
      ),
    ).toBe(true);
  });

  it("rejects requests with different pickup zones", () => {
    expect(
      areRideRequestsCompatible(
        {
          pickupZone: "BANANI",
          destinationZone: "GULSHAN_1",
        },
        {
          pickupZone: "MOHAKHALI",
          destinationZone: "GULSHAN_1",
        },
      ),
    ).toBe(false);
  });

  it("rejects a destination behind the pickup on the corridor", () => {
    expect(
      areRideRequestsCompatible(
        {
          pickupZone: "GULSHAN_1",
          destinationZone: "MOHAKHALI",
        },
        {
          pickupZone: "GULSHAN_1",
          destinationZone: "GULSHAN_2",
        },
      ),
    ).toBe(false);
  });

  it("rejects requests whose destinations are on incompatible corridors", () => {
    expect(
      areRideRequestsCompatible(
        {
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
        },
        {
          pickupZone: "BANANI",
          destinationZone: "BASHUNDHARA",
        },
      ),
    ).toBe(false);
  });
});
