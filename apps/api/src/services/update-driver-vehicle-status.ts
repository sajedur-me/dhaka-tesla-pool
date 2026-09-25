import { prisma } from "../db/prisma.js";
import {
  DriverVehicleNotFoundError,
  VehicleBusyError,
} from "./driver-errors.js";

type DriverAvailabilityStatus =
  | "ONLINE"
  | "OFFLINE";

type UpdateDriverVehicleStatusInput = {
  driverId: string;
  status: DriverAvailabilityStatus;
};

export {
  DriverVehicleNotFoundError,
  VehicleBusyError,
};

export async function updateDriverVehicleStatus({
  driverId,
  status,
}: UpdateDriverVehicleStatusInput) {
  return prisma.$transaction(async (tx) => {
    const vehicles = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
      }>
    >`
      SELECT "id", "status"::text
      FROM "Vehicle"
      WHERE "driverId" = ${driverId}
      FOR UPDATE
    `;

    const vehicle = vehicles[0];

    if (!vehicle) {
      throw new DriverVehicleNotFoundError();
    }

    if (vehicle.status === "ON_RIDE") {
      throw new VehicleBusyError();
    }

    return tx.vehicle.update({
      where: {
        id: vehicle.id,
      },
      data: {
        status,
      },
      select: {
        id: true,
        name: true,
        capacity: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
}
