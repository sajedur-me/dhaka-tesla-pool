import type { RideStatus } from "../generated/prisma/client.js";

import { prisma } from "../db/prisma.js";
import { canTransitionRide } from "../domain/ride/can-transition-ride.js";

type TransitionRideInput = {
  rideId: string;
  driverId: string;
  nextStatus: RideStatus;
};

export async function transitionRide({
  rideId,
  driverId,
  nextStatus,
}: TransitionRideInput) {
  return prisma.$transaction(async (tx) => {
    const driver = await tx.user.findUnique({
      where: {
        id: driverId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!driver) {
      throw new Error("Driver not found");
    }

    if (driver.role !== "DRIVER") {
      throw new Error("Only drivers can transition rides");
    }

    const rides = await tx.$queryRaw<
      Array<{
        id: string;
        driverId: string | null;
        status: RideStatus;
      }>
    >`
      SELECT
        "id",
        "driverId",
        "status"
      FROM "Ride"
      WHERE "id" = ${rideId}
      FOR UPDATE
    `;

    const ride = rides[0];

    if (!ride) {
      throw new Error("Ride not found");
    }

    if (ride.driverId !== driver.id) {
      throw new Error("Driver is not assigned to this ride");
    }

    if (!canTransitionRide(ride.status, nextStatus)) {
      throw new Error(
        `Invalid ride transition: ${ride.status} -> ${nextStatus}`,
      );
    }

    const timestamp = new Date();

    const updatedRide = await tx.ride.update({
      where: {
        id: ride.id,
      },
      data: {
        status: nextStatus,
        ...(nextStatus === "STARTED"
          ? { startedAt: timestamp }
          : {}),
        ...(nextStatus === "COMPLETED"
          ? { completedAt: timestamp }
          : {}),
        ...(nextStatus === "CANCELLED"
          ? { cancelledAt: timestamp }
          : {}),
      },
    });

    await tx.ridePassenger.updateMany({
      where: {
        rideId: ride.id,
        status: {
          notIn: ["CANCELLED", "COMPLETED"],
        },
      },
      data: {
        status: nextStatus,
        ...(nextStatus === "CANCELLED"
          ? { cancelledAt: timestamp }
          : {}),
      },
    });

    return updatedRide;
  });
}
