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

    const cancelledMembership = await tx.ridePassenger.update({
      where: {
        id: membership.id,
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
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
          id: rideId,
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });
    }

    return cancelledMembership;
  });
}
