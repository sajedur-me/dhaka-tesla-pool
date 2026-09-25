import { prisma } from "../db/prisma.js";
import {
  DriverMustBeOnlineError,
  DriverVehicleNotFoundError,
} from "./driver-errors.js";

type GetDriverRideRequestsInput = {
  driverId: string;
};

export async function getDriverRideRequests({
  driverId,
}: GetDriverRideRequestsInput) {
  const vehicle = await prisma.vehicle.findUnique({
    where: {
      driverId,
    },
    select: {
      id: true,
      status: true,
      capacity: true,
    },
  });

  if (!vehicle) {
    throw new DriverVehicleNotFoundError();
  }

  if (vehicle.status !== "ONLINE") {
    throw new DriverMustBeOnlineError();
  }

  return prisma.ride.findMany({
    where: {
      status: "REQUESTED",
      driverId: null,
      vehicleId: null,
      passengers: {
        some: {
          status: "REQUESTED",
          seats: {
            lte: vehicle.capacity,
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      pickupZone: true,
      destinationZone: true,
      status: true,
      createdAt: true,
      passengers: {
        where: {
          status: "REQUESTED",
        },
        select: {
          id: true,
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
      },
    },
  });
}
