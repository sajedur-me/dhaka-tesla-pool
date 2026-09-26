import { prisma } from "../db/prisma.js";

type GetDriverRidesInput = {
  driverId: string;
};

const ACTIVE_RIDE_STATUSES = [
  "MATCHED",
  "ACCEPTED",
  "DRIVER_ARRIVED",
  "STARTED",
] as const;

const DRIVER_RIDE_SELECT = {
  id: true,
  pickupZone: true,
  destinationZone: true,
  status: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  vehicle: {
    select: {
      id: true,
      name: true,
      capacity: true,
      status: true,
    },
  },
  passengers: {
    where: {
      status: {
        not: "CANCELLED" as const,
      },
    },
    select: {
      id: true,
      passengerId: true,
      pickupZone: true,
      destinationZone: true,
      seats: true,
      status: true,
      passenger: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} as const;

export async function getDriverActiveRide({
  driverId,
}: GetDriverRidesInput) {
  return prisma.ride.findFirst({
    where: {
      driverId,
      status: {
        in: [...ACTIVE_RIDE_STATUSES],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: DRIVER_RIDE_SELECT,
  });
}

export async function getDriverRideHistory({
  driverId,
}: GetDriverRidesInput) {
  return prisma.ride.findMany({
    where: {
      driverId,
      status: "COMPLETED",
    },
    orderBy: {
      completedAt: "desc",
    },
    take: 20,
    select: DRIVER_RIDE_SELECT,
  });
}
