import type {
  DhakaZone,
  RideStatus,
} from "../generated/prisma/client.js";

import { prisma } from "../db/prisma.js";

const ACTIVE_PASSENGER_STATUSES = [
  "REQUESTED",
  "MATCHED",
  "ACCEPTED",
  "DRIVER_ARRIVED",
  "STARTED",
] as const;

type ReserveSeatsInput = {
  rideId: string;
  passengerId: string;
  pickupZone: DhakaZone;
  destinationZone: DhakaZone;
  seats: number;
  farePoisha: number;
};

export async function reserveSeats({
  rideId,
  passengerId,
  pickupZone,
  destinationZone,
  seats,
  farePoisha,
}: ReserveSeatsInput) {
  if (!Number.isInteger(seats) || seats <= 0) {
    throw new Error("Seats must be greater than zero");
  }

  if (!Number.isInteger(farePoisha) || farePoisha < 0) {
    throw new Error("Fare must be a non-negative integer");
  }

  if (pickupZone === destinationZone) {
    throw new Error("Pickup and destination must be different");
  }

  return prisma.$transaction(async (tx) => {
    const rides = await tx.$queryRaw<
      Array<{
        id: string;
        vehicleId: string | null;
        status: RideStatus;
      }>
    >`
      SELECT
        "id",
        "vehicleId",
        "status"
      FROM "Ride"
      WHERE "id" = ${rideId}
      FOR UPDATE
    `;

    const ride = rides[0];

    if (!ride) {
      throw new Error("Ride not found");
    }

    if (!ride.vehicleId) {
      throw new Error("Ride has no assigned vehicle");
    }

    if (
      ride.status === "COMPLETED" ||
      ride.status === "CANCELLED"
    ) {
      throw new Error("Ride is not accepting passengers");
    }

    const vehicles = await tx.$queryRaw<
      Array<{
        id: string;
        capacity: number;
      }>
    >`
      SELECT
        "id",
        "capacity"
      FROM "Vehicle"
      WHERE "id" = ${ride.vehicleId}
      FOR UPDATE
    `;

    const vehicle = vehicles[0];

    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    const occupiedResult = await tx.ridePassenger.aggregate({
      _sum: {
        seats: true,
      },
      where: {
        rideId,
        status: {
          in: [...ACTIVE_PASSENGER_STATUSES],
        },
      },
    });

    const occupiedSeats = occupiedResult._sum.seats ?? 0;

    if (occupiedSeats + seats > vehicle.capacity) {
      throw new Error("Not enough seats available");
    }

    return tx.ridePassenger.create({
      data: {
        rideId,
        passengerId,
        pickupZone,
        destinationZone,
        seats,
        farePoisha,
      },
    });
  });
}
