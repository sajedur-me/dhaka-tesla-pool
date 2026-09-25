import {
  ALLOWED_RIDE_TRANSITIONS,
  type RideStatus,
} from "./ride-status.js";

export function canTransitionRide(
  currentStatus: RideStatus,
  nextStatus: RideStatus,
): boolean {
  return ALLOWED_RIDE_TRANSITIONS[currentStatus].includes(nextStatus);
}
