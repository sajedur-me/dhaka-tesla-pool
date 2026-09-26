import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "../db/prisma.js";
import { acceptRideRequest } from "./accept-ride-request.js";
import {
  DriverAlreadyHasActiveRideError,
  DriverMustBeOnlineError,
  DriverVehicleNotFoundError,
  RideCapacityExceededError,
  RideRequestNotFoundError,
  RideRequestUnavailableError,
} from "./driver-errors.js";

describe("acceptRideRequest", () => {
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

  async function createDriver({
    name,
    email,
    vehicleName,
    status = "ONLINE",
  }: {
    name: string;
    email: string;
    vehicleName: string;
    status?: "OFFLINE" | "ONLINE" | "ON_RIDE";
  }) {
    const driver = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: "test-password-hash",
        role: "DRIVER",
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        name: vehicleName,
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

  let passengerSequence = 0;

  async function createPassengerRequest(
    seats = 1,
  ) {
    passengerSequence += 1;

    const passenger = await prisma.user.create({
      data: {
        name: `Passenger ${passengerSequence}`,
        email: `passenger-${passengerSequence}@example.com`,
        passwordHash: "test-password-hash",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "REQUESTED",
        passengers: {
          create: {
            passengerId: passenger.id,
            pickupZone: "BANANI",
            destinationZone: "MOHAKHALI",
            seats,
            farePoisha: 8_800,
            status: "REQUESTED",
          },
        },
      },
      include: {
        passengers: true,
      },
    });

    return {
      passenger,
      ride,
    };
  }

  it("allows an online driver to accept a ride request", async () => {
    const { driver, vehicle } = await createDriver({
      name: "Jashim",
      email: "jashim@example.com",
      vehicleName: "Bullet",
    });

    const { ride } = await createPassengerRequest();

    const acceptedRide = await acceptRideRequest({
      driverId: driver.id,
      rideId: ride.id,
    });

    expect(acceptedRide).toMatchObject({
      id: ride.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      status: "ACCEPTED",
    });

    expect(acceptedRide.passengers).toHaveLength(1);

    expect(acceptedRide.passengers[0]).toMatchObject({
      passengerId: ride.passengers[0]?.passengerId,
      seats: 1,
      status: "ACCEPTED",
    });

    const storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
        include: {
          passengers: true,
        },
      });

    expect(storedRide.status).toBe("ACCEPTED");
    expect(storedRide.driverId).toBe(driver.id);
    expect(storedRide.vehicleId).toBe(vehicle.id);
    expect(storedRide.passengers[0]?.status).toBe(
      "ACCEPTED",
    );
  });

  it("keeps the vehicle online after acceptance", async () => {
    const { driver, vehicle } = await createDriver({
      name: "Jashim",
      email: "jashim@example.com",
      vehicleName: "Bullet",
    });

    const { ride } = await createPassengerRequest();

    await acceptRideRequest({
      driverId: driver.id,
      rideId: ride.id,
    });

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedVehicle.status).toBe("ONLINE");
  });

  it("requires the driver vehicle to be online", async () => {
    const { driver } = await createDriver({
      name: "Jashim",
      email: "jashim@example.com",
      vehicleName: "Bullet",
      status: "OFFLINE",
    });

    const { ride } = await createPassengerRequest();

    await expect(
      acceptRideRequest({
        driverId: driver.id,
        rideId: ride.id,
      }),
    ).rejects.toBeInstanceOf(
      DriverMustBeOnlineError,
    );

    const storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    expect(storedRide.status).toBe("REQUESTED");
    expect(storedRide.driverId).toBeNull();
    expect(storedRide.vehicleId).toBeNull();
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

    const { ride } = await createPassengerRequest();

    await expect(
      acceptRideRequest({
        driverId: driver.id,
        rideId: ride.id,
      }),
    ).rejects.toBeInstanceOf(
      DriverVehicleNotFoundError,
    );
  });

  it("rejects a missing ride request", async () => {
    const { driver } = await createDriver({
      name: "Jashim",
      email: "jashim@example.com",
      vehicleName: "Bullet",
    });

    await expect(
      acceptRideRequest({
        driverId: driver.id,
        rideId:
          "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toBeInstanceOf(
      RideRequestNotFoundError,
    );
  });

  it("rejects a request that is no longer available", async () => {
    const { driver: firstDriver, vehicle } =
      await createDriver({
        name: "Jashim",
        email: "jashim@example.com",
        vehicleName: "Bullet",
      });

    const secondDriver = await prisma.user.create({
      data: {
        name: "Second Driver",
        email: "second-driver@example.com",
        passwordHash: "test-password-hash",
        role: "DRIVER",
      },
    });

    const { ride } = await createPassengerRequest();

    await prisma.ride.update({
      where: {
        id: ride.id,
      },
      data: {
        driverId: firstDriver.id,
        vehicleId: vehicle.id,
        status: "ACCEPTED",
      },
    });

    await expect(
      acceptRideRequest({
        driverId: secondDriver.id,
        rideId: ride.id,
      }),
    ).rejects.toBeInstanceOf(
      RideRequestUnavailableError,
    );
  });

  it("rejects a request that exceeds vehicle capacity", async () => {
    const { driver } = await createDriver({
      name: "Jashim",
      email: "jashim@example.com",
      vehicleName: "Bullet",
    });

    const { ride } =
      await createPassengerRequest(4);

    await expect(
      acceptRideRequest({
        driverId: driver.id,
        rideId: ride.id,
      }),
    ).rejects.toBeInstanceOf(
      RideCapacityExceededError,
    );

    const storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    expect(storedRide.status).toBe("REQUESTED");
    expect(storedRide.driverId).toBeNull();
    expect(storedRide.vehicleId).toBeNull();
  });

  it("allows only one driver to win a concurrent claim", async () => {
    const first = await createDriver({
      name: "Jashim",
      email: "jashim@example.com",
      vehicleName: "Bullet",
    });

    const second = await createDriver({
      name: "Karim",
      email: "karim@example.com",
      vehicleName: "Second Tesla",
    });

    const { ride } = await createPassengerRequest();

    const results = await Promise.allSettled([
      acceptRideRequest({
        driverId: first.driver.id,
        rideId: ride.id,
      }),
      acceptRideRequest({
        driverId: second.driver.id,
        rideId: ride.id,
      }),
    ]);

    const fulfilled = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof acceptRideRequest>>
      > => result.status === "fulfilled",
    );

    const rejected = results.filter(
      (
        result,
      ): result is PromiseRejectedResult =>
        result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect(rejected[0]?.reason).toBeInstanceOf(
      RideRequestUnavailableError,
    );

    const storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
        include: {
          passengers: true,
        },
      });

    expect(storedRide.status).toBe("ACCEPTED");
    expect(storedRide.driverId).not.toBeNull();
    expect(storedRide.vehicleId).not.toBeNull();

    expect([
      first.driver.id,
      second.driver.id,
    ]).toContain(storedRide.driverId);

    expect(storedRide.passengers).toHaveLength(1);
    expect(storedRide.passengers[0]?.status).toBe(
      "ACCEPTED",
    );
  });

  it("rejects a second independent ride while the driver already has an active ride", async () => {
    const { driver, vehicle } = await createDriver({
      name: "Jashim",
      email: "jashim@example.com",
      vehicleName: "Bullet",
    });

    const firstRequest = await createPassengerRequest();
    const secondRequest = await createPassengerRequest();

    await acceptRideRequest({
      driverId: driver.id,
      rideId: firstRequest.ride.id,
    });

    await expect(
      acceptRideRequest({
        driverId: driver.id,
        rideId: secondRequest.ride.id,
      }),
    ).rejects.toBeInstanceOf(
      DriverAlreadyHasActiveRideError,
    );

    const firstRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: firstRequest.ride.id,
        },
      });

    const secondRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: secondRequest.ride.id,
        },
      });

    expect(firstRide.status).toBe("ACCEPTED");
    expect(firstRide.driverId).toBe(driver.id);
    expect(firstRide.vehicleId).toBe(vehicle.id);

    expect(secondRide.status).toBe("REQUESTED");
    expect(secondRide.driverId).toBeNull();
    expect(secondRide.vehicleId).toBeNull();
  });

  it("allows only one independent ride when the same driver accepts concurrently", async () => {
    const { driver, vehicle } = await createDriver({
      name: "Jashim",
      email: "jashim@example.com",
      vehicleName: "Bullet",
    });

    const firstRequest = await createPassengerRequest();
    const secondRequest = await createPassengerRequest();

    const results = await Promise.allSettled([
      acceptRideRequest({
        driverId: driver.id,
        rideId: firstRequest.ride.id,
      }),
      acceptRideRequest({
        driverId: driver.id,
        rideId: secondRequest.ride.id,
      }),
    ]);

    const fulfilled = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof acceptRideRequest>>
      > => result.status === "fulfilled",
    );

    const rejected = results.filter(
      (
        result,
      ): result is PromiseRejectedResult =>
        result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect(rejected[0]?.reason).toBeInstanceOf(
      DriverAlreadyHasActiveRideError,
    );

    const assignedRides = await prisma.ride.findMany({
      where: {
        vehicleId: vehicle.id,
        status: "ACCEPTED",
      },
    });

    const unassignedRides = await prisma.ride.findMany({
      where: {
        id: {
          in: [
            firstRequest.ride.id,
            secondRequest.ride.id,
          ],
        },
        status: "REQUESTED",
        driverId: null,
        vehicleId: null,
      },
    });

    expect(assignedRides).toHaveLength(1);
    expect(unassignedRides).toHaveLength(1);
  });

});
