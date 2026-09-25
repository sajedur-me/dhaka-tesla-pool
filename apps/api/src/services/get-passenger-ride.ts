import { prisma } from "../db/prisma.js";

type GetPassengerRideInput = {
  passengerId: string;
  rideId: string;
};

export async function getPassengerRide({
  passengerId,
  rideId,
}: GetPassengerRideInput) {
  return prisma.ridePassenger.findFirst({
    where: {
      passengerId,
      rideId,
    },
    select: {
      id: true,
      rideId: true,
      pickupZone: true,
      destinationZone: true,
      seats: true,
      farePoisha: true,
      status: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
      ride: {
        select: {
          driverId: true,
          vehicleId: true,
          status: true,
          startedAt: true,
          completedAt: true,
        },
      },
    },
  });
}
