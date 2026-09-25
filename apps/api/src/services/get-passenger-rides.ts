import { prisma } from "../db/prisma.js";

type GetPassengerRidesInput = {
  passengerId: string;
};

export async function getPassengerRides({
  passengerId,
}: GetPassengerRidesInput) {
  return prisma.ridePassenger.findMany({
    where: {
      passengerId,
    },
    orderBy: {
      createdAt: "desc",
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
