import type { RideStatus } from "../generated/prisma/client.js";

import { prisma } from "../db/prisma.js";
import { canTransitionRide } from "../domain/ride/can-transition-ride.js";

const DRIVER_RIDE_TRANSITIONS: Partial<
  Record<RideStatus, readonly RideStatus[]>
> = {
  MATCHED: ["ACCEPTED"],
  ACCEPTED: ["DRIVER_ARRIVED"],
  DRIVER_ARRIVED: ["STARTED"],
  STARTED: ["COMPLETED"],
};

type TransitionRideInput = {
  rideId: string;
  driverId: string;
  nextStatus: RideStatus;
};

function canDriverTransitionRide(
  currentStatus: RideStatus,
  nextStatus: RideStatus,
): boolean {
  return (
    DRIVER_RIDE_TRANSITIONS[currentStatus]?.includes(nextStatus) ??
    false
  );
}

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

    if (
      !canTransitionRide(ride.status, nextStatus) ||
      !canDriverTransitionRide(ride.status, nextStatus)
    ) {
      throw new Error(
        `Invalid driver ride transition: ${ride.status} -> ${nextStatus}`,
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
      },
    });

    return updatedRide;
  });
}
