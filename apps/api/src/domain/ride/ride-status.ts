export const RIDE_STATUSES = [
  "REQUESTED",
  "MATCHED",
  "ACCEPTED",
  "DRIVER_ARRIVED",
  "STARTED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type RideStatus = (typeof RIDE_STATUSES)[number];

export const ALLOWED_RIDE_TRANSITIONS: Record<
  RideStatus,
  readonly RideStatus[]
> = {
  REQUESTED: ["MATCHED", "CANCELLED"],
  MATCHED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVED: ["STARTED", "CANCELLED"],
  STARTED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};
