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
});
