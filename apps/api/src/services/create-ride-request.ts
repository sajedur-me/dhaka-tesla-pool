import type { DhakaZone } from "../generated/prisma/client.js";

import { prisma } from "../db/prisma.js";

type CreateRideRequestInput = {
  passengerId: string;
  pickupZone: DhakaZone;
  destinationZone: DhakaZone;
  seats: number;
  estimatedFarePoisha: number;
};

export async function createRideRequest({
  passengerId,
  pickupZone,
  destinationZone,
  seats,
  estimatedFarePoisha,
}: CreateRideRequestInput) {
  if (pickupZone === destinationZone) {
    throw new Error("Pickup and destination must be different");
  }

  if (!Number.isInteger(seats) || seats <= 0) {
    throw new Error("Seats must be greater than zero");
  }

  if (
    !Number.isInteger(estimatedFarePoisha) ||
    estimatedFarePoisha < 0
  ) {
    throw new Error("Fare must be a non-negative integer");
  }

  const passenger = await prisma.user.findUnique({
    where: {
      id: passengerId,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!passenger) {
    throw new Error("Passenger not found");
  }

  if (passenger.role !== "PASSENGER") {
    throw new Error("Only passengers can request rides");
  }

  return prisma.$transaction(async (tx) => {
    const ride = await tx.ride.create({
      data: {
        pickupZone,
        destinationZone,
        status: "REQUESTED",
      },
    });

    const membership = await tx.ridePassenger.create({
      data: {
        rideId: ride.id,
        passengerId,
        pickupZone,
        destinationZone,
        seats,
        farePoisha: estimatedFarePoisha,
        status: "REQUESTED",
      },
    });

    return {
      ride,
      membership,
    };
  });
}
