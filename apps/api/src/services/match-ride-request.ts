import type {
  DhakaZone,
  RidePassengerStatus,
  RideStatus,
  VehicleStatus,
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

const OPEN_POOL_STATUSES = [
  "REQUESTED",
  "MATCHED",
  "ACCEPTED",
] as const;

type MatchRideRequestInput = {
  requestRideId: string;
};

function getJoinedPassengerStatus(
  rideStatus: RideStatus,
): RidePassengerStatus {
  if (rideStatus === "ACCEPTED") {
    return "ACCEPTED";
  }

  return "MATCHED";
}

function getPoolStatusAfterMatch(
  rideStatus: RideStatus,
): RideStatus {
  if (rideStatus === "ACCEPTED") {
    return "ACCEPTED";
  }

  return "MATCHED";
}

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
      throw new Error(
        "Ride request is not available for matching",
      );
    }

    const requestMembership =
      await tx.ridePassenger.findFirst({
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
          in: [...OPEN_POOL_STATUSES],
        },
        vehicle: {
          is: {
            status: "ONLINE",
          },
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
          destinationZone:
            requestMembership.destinationZone,
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
        (total, passenger) =>
          total + passenger.seats,
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

    const lockedCandidates = await tx.$queryRaw<
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
      WHERE "id" = ${candidate.id}
      FOR UPDATE
    `;

    const lockedCandidate = lockedCandidates[0];

    if (!lockedCandidate) {
      return null;
    }

    if (
      !OPEN_POOL_STATUSES.some(
        (status) =>
          status === lockedCandidate.status,
      )
    ) {
      return null;
    }

    if (
      !lockedCandidate.vehicleId ||
      lockedCandidate.vehicleId !==
        candidate.vehicleId
    ) {
      return null;
    }

    const lockedVehicles = await tx.$queryRaw<
      Array<{
        id: string;
        capacity: number;
        status: VehicleStatus;
      }>
    >`
      SELECT
        "id",
        "capacity",
        "status"
      FROM "Vehicle"
      WHERE "id" = ${lockedCandidate.vehicleId}
      FOR UPDATE
    `;

    const vehicle = lockedVehicles[0];

    if (!vehicle) {
      return null;
    }

    if (vehicle.status !== "ONLINE") {
      return null;
    }

    const occupiedResult =
      await tx.ridePassenger.aggregate({
        _sum: {
          seats: true,
        },
        where: {
          rideId: lockedCandidate.id,
          status: {
            in: [...ACTIVE_PASSENGER_STATUSES],
          },
        },
      });

    const occupiedSeats =
      occupiedResult._sum.seats ?? 0;

    if (
      occupiedSeats + requestMembership.seats >
      vehicle.capacity
    ) {
      return null;
    }

    const joinedPassengerStatus =
      getJoinedPassengerStatus(
        lockedCandidate.status,
      );

    const poolStatus =
      getPoolStatusAfterMatch(
        lockedCandidate.status,
      );

    const matchedMembership =
      await tx.ridePassenger.update({
        where: {
          id: requestMembership.id,
        },
        data: {
          rideId: lockedCandidate.id,
          status: joinedPassengerStatus,
        },
      });

    await tx.ride.update({
      where: {
        id: lockedCandidate.id,
      },
      data: {
        status: poolStatus,
      },
    });

    await tx.ride.delete({
      where: {
        id: requestRide.id,
      },
    });

    return {
      rideId: lockedCandidate.id,
      membership: matchedMembership,
    };
  });
}
