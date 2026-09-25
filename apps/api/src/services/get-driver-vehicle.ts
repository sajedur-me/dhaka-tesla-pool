import { prisma } from "../db/prisma.js";

type GetDriverVehicleInput = {
  driverId: string;
};

export async function getDriverVehicle({
  driverId,
}: GetDriverVehicleInput) {
  return prisma.vehicle.findUnique({
    where: {
      driverId,
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
}
