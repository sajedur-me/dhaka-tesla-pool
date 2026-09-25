import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "../db/prisma.js";
import {
  DriverMustBeOnlineError,
  DriverVehicleNotFoundError,
} from "./driver-errors.js";
import { getDriverRideRequests } from "./get-driver-ride-requests.js";

describe("getDriverRideRequests", () => {
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
    status: "OFFLINE" | "ONLINE" | "ON_RIDE" = "ONLINE",
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

  async function createPassengerRideRequest({
    name,
    email,
    pickupZone,
    destinationZone,
    seats,
    farePoisha,
  }: {
    name: string;
    email: string;
    pickupZone:
      | "BANANI"
      | "MOHAKHALI"
      | "GULSHAN_1"
      | "GULSHAN_2";
    destinationZone:
      | "BANANI"
      | "MOHAKHALI"
      | "GULSHAN_1"
      | "GULSHAN_2";
    seats: number;
    farePoisha: number;
  }) {
    const passenger = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: "test-password-hash",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        pickupZone,
        destinationZone,
        status: "REQUESTED",
        passengers: {
          create: {
            passengerId: passenger.id,
            pickupZone,
            destinationZone,
            seats,
            farePoisha,
            status: "REQUESTED",
          },
        },
      },
    });

    return {
      passenger,
      ride,
    };
  }

  it("returns available passenger requests for an online driver", async () => {
    const { driver } =
      await createDriverWithBullet("ONLINE");

    const { ride } =
      await createPassengerRideRequest({
        name: "Nusrat",
        email: "nusrat@example.com",
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        farePoisha: 8_800,
      });

    const requests = await getDriverRideRequests({
      driverId: driver.id,
    });

    expect(requests).toHaveLength(1);

    expect(requests[0]).toMatchObject({
      id: ride.id,
      pickupZone: "BANANI",
      destinationZone: "MOHAKHALI",
      status: "REQUESTED",
    });

    expect(requests[0]?.passengers).toHaveLength(1);

    expect(requests[0]?.passengers[0]).toMatchObject({
      pickupZone: "BANANI",
      destinationZone: "MOHAKHALI",
      seats: 1,
      status: "REQUESTED",
      passenger: {
        name: "Nusrat",
      },
    });
  });

  it("does not expose the passenger fare", async () => {
    const { driver } =
      await createDriverWithBullet("ONLINE");

    await createPassengerRideRequest({
      name: "Nusrat",
      email: "nusrat@example.com",
      pickupZone: "BANANI",
      destinationZone: "MOHAKHALI",
      seats: 1,
      farePoisha: 8_800,
    });

    const requests = await getDriverRideRequests({
      driverId: driver.id,
    });

    expect(requests).toHaveLength(1);

    expect(
      requests[0]?.passengers[0],
    ).not.toHaveProperty("farePoisha");
  });

  it("returns multiple available requests in creation order", async () => {
    const { driver } =
      await createDriverWithBullet("ONLINE");

    const first =
      await createPassengerRideRequest({
        name: "Nusrat",
        email: "nusrat@example.com",
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        farePoisha: 8_800,
      });

    const second =
      await createPassengerRideRequest({
        name: "Rafiq",
        email: "rafiq@example.com",
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        seats: 1,
        farePoisha: 10_400,
      });

    const requests = await getDriverRideRequests({
      driverId: driver.id,
    });

    expect(requests.map((request) => request.id)).toEqual([
      first.ride.id,
      second.ride.id,
    ]);
  });

  it("does not return requests that exceed Bullet's capacity", async () => {
    const { driver } =
      await createDriverWithBullet("ONLINE");

    await createPassengerRideRequest({
      name: "Large Group",
      email: "large-group@example.com",
      pickupZone: "BANANI",
      destinationZone: "MOHAKHALI",
      seats: 4,
      farePoisha: 20_000,
    });

    const requests = await getDriverRideRequests({
      driverId: driver.id,
    });

    expect(requests).toEqual([]);
  });

  it("does not return rides that are already assigned", async () => {
    const { driver, vehicle } =
      await createDriverWithBullet("ONLINE");

    const { ride } =
      await createPassengerRideRequest({
        name: "Nusrat",
        email: "nusrat@example.com",
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        farePoisha: 8_800,
      });

    await prisma.ride.update({
      where: {
        id: ride.id,
      },
      data: {
        driverId: driver.id,
        vehicleId: vehicle.id,
        status: "MATCHED",
      },
    });

    const requests = await getDriverRideRequests({
      driverId: driver.id,
    });

    expect(requests).toEqual([]);
  });

  it("requires the driver to be online", async () => {
    const { driver } =
      await createDriverWithBullet("OFFLINE");

    await expect(
      getDriverRideRequests({
        driverId: driver.id,
      }),
    ).rejects.toBeInstanceOf(
      DriverMustBeOnlineError,
    );
  });

  it("rejects a driver without an assigned vehicle", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Driver Without Vehicle",
        email: "no-vehicle@example.com",
        passwordHash: "test-password-hash",
        role: "DRIVER",
      },
    });

    await expect(
      getDriverRideRequests({
        driverId: driver.id,
      }),
    ).rejects.toBeInstanceOf(
      DriverVehicleNotFoundError,
    );
  });
});
