import { describe, expect, it } from "vitest";

import { canTransitionRide } from "./can-transition-ride.js";

describe("canTransitionRide", () => {
  it.each([
    ["REQUESTED", "MATCHED"],
    ["MATCHED", "ACCEPTED"],
    ["ACCEPTED", "DRIVER_ARRIVED"],
    ["DRIVER_ARRIVED", "STARTED"],
    ["STARTED", "COMPLETED"],
  ] as const)("allows %s → %s", (currentStatus, nextStatus) => {
    expect(canTransitionRide(currentStatus, nextStatus)).toBe(true);
  });

  it.each([
    ["REQUESTED", "CANCELLED"],
    ["MATCHED", "CANCELLED"],
    ["ACCEPTED", "CANCELLED"],
    ["DRIVER_ARRIVED", "CANCELLED"],
  ] as const)("allows cancellation from %s", (currentStatus, nextStatus) => {
    expect(canTransitionRide(currentStatus, nextStatus)).toBe(true);
  });

  it.each([
    ["REQUESTED", "COMPLETED"],
    ["MATCHED", "STARTED"],
    ["ACCEPTED", "COMPLETED"],
    ["STARTED", "CANCELLED"],
    ["COMPLETED", "CANCELLED"],
    ["CANCELLED", "REQUESTED"],
  ] as const)("rejects %s → %s", (currentStatus, nextStatus) => {
    expect(canTransitionRide(currentStatus, nextStatus)).toBe(false);
  });
});
