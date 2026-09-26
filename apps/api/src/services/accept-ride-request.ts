import { prisma } from "../db/prisma.js";
import {
  DriverAlreadyHasActiveRideError,
  DriverMustBeOnlineError,
  DriverVehicleNotFoundError,
  RideCapacityExceededError,
  RideRequestNotFoundError,
  RideRequestUnavailableError,
} from "./driver-errors.js";

type AcceptRideRequestInput = {
  driverId: string;
  rideId: string;
};

export async function acceptRideRequest({
  driverId,
  rideId,
}: AcceptRideRequestInput) {
  return prisma.$transaction(async (tx) => {
    const rides = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        driverId: string | null;
        vehicleId: string | null;
      }>
    >`
      SELECT
        "id",
        "status"::text,
        "driverId",
        "vehicleId"
      FROM "Ride"
      WHERE "id" = ${rideId}
      FOR UPDATE
    `;

    const ride = rides[0];

    if (!ride) {
      throw new RideRequestNotFoundError();
    }

    if (
      ride.status !== "REQUESTED" ||
      ride.driverId !== null ||
      ride.vehicleId !== null
    ) {
      throw new RideRequestUnavailableError();
    }

    const vehicles = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        capacity: number;
      }>
    >`
      SELECT
        "id",
        "status"::text,
        "capacity"
      FROM "Vehicle"
      WHERE "driverId" = ${driverId}
      FOR UPDATE
    `;

    const vehicle = vehicles[0];

    if (!vehicle) {
      throw new DriverVehicleNotFoundError();
    }

    if (vehicle.status !== "ONLINE") {
      throw new DriverMustBeOnlineError();
    }

    const existingActiveRide = await tx.ride.findFirst({
      where: {
        vehicleId: vehicle.id,
        status: {
          in: [
            "ACCEPTED",
            "DRIVER_ARRIVED",
            "STARTED",
          ],
        },
      },
      select: {
        id: true,
      },
    });

    if (existingActiveRide) {
      throw new DriverAlreadyHasActiveRideError();
    }

    const passengers = await tx.ridePassenger.findMany({
      where: {
        rideId,
        status: "REQUESTED",
      },
      select: {
        id: true,
        seats: true,
      },
    });

    if (passengers.length === 0) {
      throw new RideRequestUnavailableError();
    }

    const requestedSeats = passengers.reduce(
      (total, passenger) => total + passenger.seats,
      0,
    );

    if (requestedSeats > vehicle.capacity) {
      throw new RideCapacityExceededError();
    }

    await tx.ridePassenger.updateMany({
      where: {
        rideId,
        status: "REQUESTED",
      },
      data: {
        status: "ACCEPTED",
      },
    });

    return tx.ride.update({
      where: {
        id: rideId,
      },
      data: {
        driverId,
        vehicleId: vehicle.id,
        status: "ACCEPTED",
      },
      select: {
        id: true,
        driverId: true,
        vehicleId: true,
        pickupZone: true,
        destinationZone: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        passengers: {
          select: {
            id: true,
            passengerId: true,
            pickupZone: true,
            destinationZone: true,
            seats: true,
            status: true,
          },
        },
      },
    });
  });
}
