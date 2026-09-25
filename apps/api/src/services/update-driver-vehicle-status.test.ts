import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "../db/prisma.js";
import { getDriverVehicle } from "./get-driver-vehicle.js";
import {
  DriverVehicleNotFoundError,
  updateDriverVehicleStatus,
  VehicleBusyError,
} from "./update-driver-vehicle-status.js";

describe("driver vehicle services", () => {
  beforeEach(async () => {
    await prisma.ridePassenger.deleteMany();
    await prisma.ride.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.ridePassenger.deleteMany();
    await prisma.ride.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.user.deleteMany();

    await prisma.$disconnect();
  });

  async function createDriverWithBullet(
    status: "OFFLINE" | "ONLINE" | "ON_RIDE" = "OFFLINE",
  ) {
    const driver = await prisma.user.create({
      data: {
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "test-password-hash",
        role: "DRIVER",
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        name: "Bullet",
        capacity: 3,
        status,
        driverId: driver.id,
      },
    });

    return {
      driver,
      vehicle,
    };
  }

  it("returns the driver's assigned vehicle", async () => {
    const { driver } =
      await createDriverWithBullet();

    const vehicle = await getDriverVehicle({
      driverId: driver.id,
    });

    expect(vehicle).toMatchObject({
      name: "Bullet",
      capacity: 3,
      status: "OFFLINE",
    });
  });

  it("returns null when the driver has no vehicle", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Driver Without Vehicle",
        email: "no-vehicle@example.com",
        passwordHash: "test-password-hash",
        role: "DRIVER",
      },
    });

    const vehicle = await getDriverVehicle({
      driverId: driver.id,
    });

    expect(vehicle).toBeNull();
  });

  it("takes Bullet online", async () => {
    const { driver } =
      await createDriverWithBullet("OFFLINE");

    const vehicle = await updateDriverVehicleStatus({
      driverId: driver.id,
      status: "ONLINE",
    });

    expect(vehicle).toMatchObject({
      name: "Bullet",
      capacity: 3,
      status: "ONLINE",
    });

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          driverId: driver.id,
        },
      });

    expect(storedVehicle.status).toBe("ONLINE");
  });

  it("takes Bullet offline", async () => {
    const { driver } =
      await createDriverWithBullet("ONLINE");

    const vehicle = await updateDriverVehicleStatus({
      driverId: driver.id,
      status: "OFFLINE",
    });

    expect(vehicle.status).toBe("OFFLINE");

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          driverId: driver.id,
        },
      });

    expect(storedVehicle.status).toBe("OFFLINE");
  });

  it("rejects availability changes while Bullet is on a ride", async () => {
    const { driver } =
      await createDriverWithBullet("ON_RIDE");

    await expect(
      updateDriverVehicleStatus({
        driverId: driver.id,
        status: "OFFLINE",
      }),
    ).rejects.toBeInstanceOf(VehicleBusyError);

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          driverId: driver.id,
        },
      });

    expect(storedVehicle.status).toBe("ON_RIDE");
  });

  it("rejects an availability change when the driver has no vehicle", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Driver Without Vehicle",
        email: "missing-bullet@example.com",
        passwordHash: "test-password-hash",
        role: "DRIVER",
      },
    });

    await expect(
      updateDriverVehicleStatus({
        driverId: driver.id,
        status: "ONLINE",
      }),
    ).rejects.toBeInstanceOf(
      DriverVehicleNotFoundError,
    );
  });
});
