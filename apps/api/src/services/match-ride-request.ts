import type {
  DhakaZone,
  RideStatus,
} from "../generated/prisma/client.js";

import { prisma } from "../db/prisma.js";
import { areRideRequestsCompatible } from "../domain/pooling/are-ride-requests-compatible.js";

const ACTIVE_PASSENGER_STATUSES = [
  "REQUESTED",
  "MATCHED",
  "ACCEPTED",
  "DRIVER_ARRIVED",
  "STARTED",
] as const;

type MatchRideRequestInput = {
  requestRideId: string;
};

export async function matchRideRequest({
  requestRideId,
}: MatchRideRequestInput) {
  return prisma.$transaction(async (tx) => {
    const requestRides = await tx.$queryRaw<
      Array<{
        id: string;
        pickupZone: DhakaZone;
        destinationZone: DhakaZone;
        status: RideStatus;
      }>
    >`
      SELECT
        "id",
        "pickupZone",
        "destinationZone",
        "status"
      FROM "Ride"
      WHERE "id" = ${requestRideId}
      FOR UPDATE
    `;

    const requestRide = requestRides[0];

    if (!requestRide) {
      throw new Error("Ride request not found");
    }

    if (requestRide.status !== "REQUESTED") {
      throw new Error("Ride request is not available for matching");
    }

    const requestMembership = await tx.ridePassenger.findFirst({
      where: {
        rideId: requestRide.id,
        status: "REQUESTED",
      },
    });

    if (!requestMembership) {
      throw new Error("Passenger request not found");
    }

    const candidateRides = await tx.ride.findMany({
      where: {
        id: {
          not: requestRide.id,
        },
        vehicleId: {
          not: null,
        },
        status: {
          in: ["REQUESTED", "MATCHED", "ACCEPTED"],
        },
      },
      include: {
        vehicle: true,
        passengers: {
          where: {
            status: {
              in: [...ACTIVE_PASSENGER_STATUSES],
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const candidate = candidateRides.find((ride) => {
      if (!ride.vehicle) {
        return false;
      }

      const compatible = areRideRequestsCompatible(
        {
          pickupZone: requestMembership.pickupZone,
          destinationZone: requestMembership.destinationZone,
        },
        {
          pickupZone: ride.pickupZone,
          destinationZone: ride.destinationZone,
        },
      );

      if (!compatible) {
        return false;
      }

      const occupiedSeats = ride.passengers.reduce(
        (total, passenger) => total + passenger.seats,
        0,
      );

      return (
        occupiedSeats + requestMembership.seats <=
        ride.vehicle.capacity
      );
    });

    if (!candidate || !candidate.vehicleId) {
      return null;
    }

    const lockedVehicles = await tx.$queryRaw<
      Array<{
        id: string;
        capacity: number;
      }>
    >`
      SELECT
        "id",
        "capacity"
      FROM "Vehicle"
      WHERE "id" = ${candidate.vehicleId}
      FOR UPDATE
    `;

    const vehicle = lockedVehicles[0];

    if (!vehicle) {
      throw new Error("Vehicle not found");
    }

    const occupiedResult = await tx.ridePassenger.aggregate({
      _sum: {
        seats: true,
      },
      where: {
        rideId: candidate.id,
        status: {
          in: [...ACTIVE_PASSENGER_STATUSES],
        },
      },
    });

    const occupiedSeats = occupiedResult._sum.seats ?? 0;

    if (
      occupiedSeats + requestMembership.seats >
      vehicle.capacity
    ) {
      return null;
    }

    const matchedMembership = await tx.ridePassenger.update({
      where: {
        id: requestMembership.id,
      },
      data: {
        rideId: candidate.id,
        status: "MATCHED",
      },
    });

    await tx.ride.update({
      where: {
        id: candidate.id,
      },
      data: {
        status: "MATCHED",
      },
    });

    await tx.ride.delete({
      where: {
        id: requestRide.id,
      },
    });

    return {
      rideId: candidate.id,
      membership: matchedMembership,
    };
  });
}
