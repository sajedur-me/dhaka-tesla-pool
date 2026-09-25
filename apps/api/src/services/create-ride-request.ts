import type { DhakaZone } from "../generated/prisma/client.js";

import { prisma } from "../db/prisma.js";
import { calculateFare } from "../domain/fare/calculate-fare.js";
import { getRouteDistance } from "../domain/fare/get-route-distance.js";

type CreateRideRequestInput = {
  passengerId: string;
  pickupZone: DhakaZone;
  destinationZone: DhakaZone;
  seats: number;
};

export async function createRideRequest({
  passengerId,
  pickupZone,
  destinationZone,
  seats,
}: CreateRideRequestInput) {
  if (pickupZone === destinationZone) {
    throw new Error("Pickup and destination must be different");
  }

  if (!Number.isInteger(seats) || seats <= 0) {
    throw new Error("Seats must be greater than zero");
  }

  const distanceKm = getRouteDistance({
    pickupZone,
    destinationZone,
  });

  const estimatedFarePoisha = calculateFare({
    distanceKm,
    isPooled: true,
  });

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
