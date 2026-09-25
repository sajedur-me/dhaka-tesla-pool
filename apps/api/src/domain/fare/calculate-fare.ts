import {
  BASE_FARE_POISHA,
  PER_KM_RATE_POISHA,
  POOL_DISCOUNT_PERCENT,
} from "./fare.constants.js";

type CalculateFareInput = {
  distanceKm: number;
  isPooled: boolean;
};

export function calculateFare({
  distanceKm,
  isPooled,
}: CalculateFareInput): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error("Distance must be greater than zero");
  }

  const subtotalPoisha =
    BASE_FARE_POISHA + distanceKm * PER_KM_RATE_POISHA;

  const farePoisha = isPooled
    ? subtotalPoisha * (1 - POOL_DISCOUNT_PERCENT / 100)
    : subtotalPoisha;

  return Math.round(farePoisha);
}
