import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { buildApp } from "../app.js";
import { prisma } from "../db/prisma.js";

describe("driver routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    app = await buildApp();
  });

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

    await app.close();
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
      token: app.jwt.sign({
        sub: driver.id,
        role: "DRIVER",
      }),
    };
  }

  async function createPassenger() {
    const passenger = await prisma.user.create({
      data: {
        name: "Nusrat",
        email: "nusrat@example.com",
        passwordHash: "test-password-hash",
        role: "PASSENGER",
      },
    });

    return {
      passenger,
      token: app.jwt.sign({
        sub: passenger.id,
        role: "PASSENGER",
      }),
    };
  }

  it("returns Bullet for the authenticated driver", async () => {
    const { token } =
      await createDriverWithBullet("OFFLINE");

    const response = await app.inject({
      method: "GET",
      url: "/driver/vehicle",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json().vehicle).toMatchObject({
      name: "Bullet",
      capacity: 3,
      status: "OFFLINE",
    });
  });

  it("rejects an unauthenticated vehicle request", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/driver/vehicle",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
    });
  });

  it("rejects a passenger from the driver vehicle endpoint", async () => {
    const { token } = await createPassenger();

    const response = await app.inject({
      method: "GET",
      url: "/driver/vehicle",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "Forbidden",
    });
  });

  it("returns 404 when the driver has no assigned vehicle", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Driver Without Vehicle",
        email: "no-vehicle@example.com",
        passwordHash: "test-password-hash",
        role: "DRIVER",
      },
    });

    const token = app.jwt.sign({
      sub: driver.id,
      role: "DRIVER",
    });

    const response = await app.inject({
      method: "GET",
      url: "/driver/vehicle",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Driver vehicle not found",
    });
  });

  it("allows the driver to take Bullet online", async () => {
    const { driver, token } =
      await createDriverWithBullet("OFFLINE");

    const response = await app.inject({
      method: "PATCH",
      url: "/driver/vehicle/status",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        status: "ONLINE",
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json().vehicle).toMatchObject({
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

  it("allows the driver to take Bullet offline", async () => {
    const { driver, token } =
      await createDriverWithBullet("ONLINE");

    const response = await app.inject({
      method: "PATCH",
      url: "/driver/vehicle/status",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        status: "OFFLINE",
      },
    });

    expect(response.statusCode).toBe(200);

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          driverId: driver.id,
        },
      });

    expect(storedVehicle.status).toBe("OFFLINE");
  });

  it("does not allow the client to set ON_RIDE directly", async () => {
    const { driver, token } =
      await createDriverWithBullet("ONLINE");

    const response = await app.inject({
      method: "PATCH",
      url: "/driver/vehicle/status",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        status: "ON_RIDE",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe(
      "Invalid request",
    );

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          driverId: driver.id,
        },
      });

    expect(storedVehicle.status).toBe("ONLINE");
  });

  it("does not allow availability changes while Bullet is on a ride", async () => {
    const { driver, token } =
      await createDriverWithBullet("ON_RIDE");

    const response = await app.inject({
      method: "PATCH",
      url: "/driver/vehicle/status",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        status: "OFFLINE",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error:
        "Vehicle cannot change availability during an active ride",
    });

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          driverId: driver.id,
        },
      });

    expect(storedVehicle.status).toBe("ON_RIDE");
  });

  it("returns 404 when changing status without an assigned vehicle", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Driver Without Bullet",
        email: "missing-vehicle@example.com",
        passwordHash: "test-password-hash",
        role: "DRIVER",
      },
    });

    const token = app.jwt.sign({
      sub: driver.id,
      role: "DRIVER",
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/driver/vehicle/status",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        status: "ONLINE",
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Driver vehicle not found",
    });
  });

  it("moves an accepted ride through arrive, start, and complete over HTTP", async () => {
    const { driver, vehicle, token } =
      await createDriverWithBullet("ONLINE");

    const { passenger } = await createPassenger();

    const ride = await prisma.ride.create({
      data: {
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "ACCEPTED",
        passengers: {
          create: {
            passengerId: passenger.id,
            pickupZone: "BANANI",
            destinationZone: "MOHAKHALI",
            seats: 1,
            farePoisha: 8_800,
            status: "ACCEPTED",
          },
        },
      },
    });

    const arriveResponse = await app.inject({
      method: "POST",
      url: `/driver/rides/${ride.id}/arrive`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(arriveResponse.statusCode).toBe(200);
    expect(arriveResponse.json().ride.status).toBe(
      "DRIVER_ARRIVED",
    );

    let storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedVehicle.status).toBe("ONLINE");

    const startResponse = await app.inject({
      method: "POST",
      url: `/driver/rides/${ride.id}/start`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(startResponse.statusCode).toBe(200);
    expect(startResponse.json().ride.status).toBe(
      "STARTED",
    );

    let storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    expect(storedRide.startedAt).not.toBeNull();

    storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedVehicle.status).toBe("ON_RIDE");

    const startedPassenger =
      await prisma.ridePassenger.findFirstOrThrow({
        where: {
          rideId: ride.id,
          passengerId: passenger.id,
        },
      });

    expect(startedPassenger.status).toBe("STARTED");

    const completeResponse = await app.inject({
      method: "POST",
      url: `/driver/rides/${ride.id}/complete`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json().ride.status).toBe(
      "COMPLETED",
    );

    storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    expect(storedRide.completedAt).not.toBeNull();

    storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedVehicle.status).toBe("ONLINE");

    const completedPassenger =
      await prisma.ridePassenger.findFirstOrThrow({
        where: {
          rideId: ride.id,
          passengerId: passenger.id,
        },
      });

    expect(completedPassenger.status).toBe(
      "COMPLETED",
    );
  });

  it("rejects lifecycle actions from an unauthenticated client", async () => {
    const { driver, vehicle } =
      await createDriverWithBullet("ONLINE");

    const ride = await prisma.ride.create({
      data: {
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "ACCEPTED",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/driver/rides/${ride.id}/arrive`,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
    });
  });

  it("rejects lifecycle actions from a passenger", async () => {
    const { driver, vehicle } =
      await createDriverWithBullet("ONLINE");

    const { token } = await createPassenger();

    const ride = await prisma.ride.create({
      data: {
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "ACCEPTED",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/driver/rides/${ride.id}/arrive`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "Forbidden",
    });
  });

  it("rejects an invalid ride ID for lifecycle actions", async () => {
    const { token } =
      await createDriverWithBullet("ONLINE");

    const response = await app.inject({
      method: "POST",
      url: "/driver/rides/not-a-uuid/arrive",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Invalid ride ID",
    });
  });

  it("returns 404 when the lifecycle ride does not exist", async () => {
    const { token } =
      await createDriverWithBullet("ONLINE");

    const response = await app.inject({
      method: "POST",
      url: "/driver/rides/00000000-0000-4000-8000-000000000000/arrive",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Ride not found",
    });
  });

  it("does not expose another driver's assigned ride", async () => {
    const { driver, vehicle } =
      await createDriverWithBullet("ONLINE");

    const otherDriver = await prisma.user.create({
      data: {
        name: "Other Driver",
        email: "other-driver@example.com",
        passwordHash: "test-password-hash",
        role: "DRIVER",
      },
    });

    const otherToken = app.jwt.sign({
      sub: otherDriver.id,
      role: "DRIVER",
    });

    const ride = await prisma.ride.create({
      data: {
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "ACCEPTED",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/driver/rides/${ride.id}/arrive`,
      headers: {
        authorization: `Bearer ${otherToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Driver is not assigned to this ride",
    });
  });

  it("rejects an invalid driver lifecycle transition", async () => {
    const { driver, vehicle, token } =
      await createDriverWithBullet("ONLINE");

    const ride = await prisma.ride.create({
      data: {
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "ACCEPTED",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/driver/rides/${ride.id}/complete`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error:
        "Invalid driver ride transition: ACCEPTED -> COMPLETED",
    });

    const storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    expect(storedRide.status).toBe("ACCEPTED");
    expect(storedRide.completedAt).toBeNull();

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedVehicle.status).toBe("ONLINE");
  });
});
