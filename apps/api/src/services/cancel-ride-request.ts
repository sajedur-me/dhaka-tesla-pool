import type { RideStatus } from "../generated/prisma/client.js";

import { prisma } from "../db/prisma.js";

const CANCELLABLE_STATUSES = [
  "REQUESTED",
  "MATCHED",
  "ACCEPTED",
  "DRIVER_ARRIVED",
] as const;

type CancelRideRequestInput = {
  passengerId: string;
  rideId: string;
};

export async function cancelRideRequest({
  passengerId,
  rideId,
}: CancelRideRequestInput) {
  return prisma.$transaction(async (tx) => {
    const rides = await tx.$queryRaw<
      Array<{
        id: string;
        status: RideStatus;
      }>
    >`
      SELECT
        "id",
        "status"
      FROM "Ride"
      WHERE "id" = ${rideId}
      FOR UPDATE
    `;

    const ride = rides[0];

    if (!ride) {
      throw new Error("Ride not found");
    }

    const memberships = await tx.$queryRaw<
      Array<{
        id: string;
        status:
          | "REQUESTED"
          | "MATCHED"
          | "ACCEPTED"
          | "DRIVER_ARRIVED"
          | "STARTED"
          | "COMPLETED"
          | "CANCELLED";
      }>
    >`
      SELECT
        "id",
        "status"
      FROM "RidePassenger"
      WHERE
        "rideId" = ${rideId}
        AND "passengerId" = ${passengerId}
      FOR UPDATE
    `;

    const membership = memberships[0];

    if (!membership) {
      throw new Error("Ride request not found");
    }

    if (
      !CANCELLABLE_STATUSES.some(
        (status) => status === membership.status,
      )
    ) {
      throw new Error(
        "Ride request cannot be cancelled in its current state",
      );
    }

    const timestamp = new Date();

    const cancelledMembership = await tx.ridePassenger.update({
      where: {
        id: membership.id,
      },
      data: {
        status: "CANCELLED",
        cancelledAt: timestamp,
      },
    });

    const activePassengerCount = await tx.ridePassenger.count({
      where: {
        rideId,
        status: {
          notIn: ["CANCELLED", "COMPLETED"],
        },
      },
    });

    if (activePassengerCount === 0) {
      await tx.ride.update({
        where: {
          id: ride.id,
        },
        data: {
          status: "CANCELLED",
          cancelledAt: timestamp,
        },
      });
    }

    return cancelledMembership;
  });
}
