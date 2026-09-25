import type { DhakaZone } from "../../generated/prisma/client.js";

type RouteKey = `${DhakaZone}:${DhakaZone}`;

const ROUTE_DISTANCES_KM: Partial<Record<RouteKey, number>> = {
  "BANANI:MOHAKHALI": 3,
  "BANANI:GULSHAN_1": 4,
  "BANANI:GULSHAN_2": 5,

  "MIRPUR:FARMGATE": 7,
  "MIRPUR:DHANMONDI": 10,
  "FARMGATE:DHANMONDI": 4,

  "UTTARA:BANANI": 10,
  "UTTARA:BASHUNDHARA": 12,
} as const;

type GetRouteDistanceInput = {
  pickupZone: DhakaZone;
  destinationZone: DhakaZone;
};

export function getRouteDistance({
  pickupZone,
  destinationZone,
}: GetRouteDistanceInput): number {
  if (pickupZone === destinationZone) {
    throw new Error("Pickup and destination must be different");
  }

  const routeKey: RouteKey = `${pickupZone}:${destinationZone}`;
  const distanceKm = ROUTE_DISTANCES_KM[routeKey];

  if (distanceKm === undefined) {
    throw new Error(
      `Unsupported route: ${pickupZone} -> ${destinationZone}`,
    );
  }

  return distanceKm;
}
