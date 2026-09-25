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

describe("driver request routes", () => {
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
      token: app.jwt.sign({
        sub: driver.id,
        role: "DRIVER",
      }),
    };
  }

  async function createPassengerRideRequest() {
    const passenger = await prisma.user.create({
      data: {
        name: "Nusrat",
        email: "nusrat@example.com",
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
            seats: 1,
            farePoisha: 8_800,
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

  it("returns available requests to an online driver", async () => {
    const { token } =
      await createDriverWithBullet("ONLINE");

    const { ride } =
      await createPassengerRideRequest();

    const response = await app.inject({
      method: "GET",
      url: "/driver/requests",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.requests).toHaveLength(1);

    expect(body.requests[0]).toMatchObject({
      id: ride.id,
      pickupZone: "BANANI",
      destinationZone: "MOHAKHALI",
      status: "REQUESTED",
    });

    expect(body.requests[0].passengers).toHaveLength(1);

    expect(
      body.requests[0].passengers[0],
    ).toMatchObject({
      pickupZone: "BANANI",
      destinationZone: "MOHAKHALI",
      seats: 1,
      status: "REQUESTED",
      passenger: {
        name: "Nusrat",
      },
    });
  });

  it("does not expose passenger fare information", async () => {
    const { token } =
      await createDriverWithBullet("ONLINE");

    await createPassengerRideRequest();

    const response = await app.inject({
      method: "GET",
      url: "/driver/requests",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(
      body.requests[0].passengers[0],
    ).not.toHaveProperty("farePoisha");
  });

  it("rejects an unauthenticated request", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/driver/requests",
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      error: "Unauthorized",
    });
  });

  it("rejects a passenger from the driver request endpoint", async () => {
    const passenger = await prisma.user.create({
      data: {
        name: "Nusrat",
        email: "nusrat@example.com",
        passwordHash: "test-password-hash",
        role: "PASSENGER",
      },
    });

    const token = app.jwt.sign({
      sub: passenger.id,
      role: "PASSENGER",
    });

    const response = await app.inject({
      method: "GET",
      url: "/driver/requests",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);

    expect(response.json()).toEqual({
      error: "Forbidden",
    });
  });

  it("requires the driver to be online", async () => {
    const { token } =
      await createDriverWithBullet("OFFLINE");

    await createPassengerRideRequest();

    const response = await app.inject({
      method: "GET",
      url: "/driver/requests",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      error: "Driver must be online",
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
      url: "/driver/requests",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toEqual({
      error: "Driver vehicle not found",
    });
  });

  it("allows an online driver to accept a ride request", async () => {
    const { driver, vehicle, token } =
      await createDriverWithBullet("ONLINE");

    const { ride } =
      await createPassengerRideRequest();

    const response = await app.inject({
      method: "POST",
      url: `/driver/requests/${ride.id}/accept`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.json().ride).toMatchObject({
      id: ride.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
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

  it("rejects an unauthenticated acceptance request", async () => {
    const { ride } =
      await createPassengerRideRequest();

    const response = await app.inject({
      method: "POST",
      url: `/driver/requests/${ride.id}/accept`,
    });

    expect(response.statusCode).toBe(401);

    expect(response.json()).toEqual({
      error: "Unauthorized",
    });
  });

  it("rejects a passenger from accepting a ride request", async () => {
    const passenger = await prisma.user.create({
      data: {
        name: "Rafiq",
        email: "rafiq@example.com",
        passwordHash: "test-password-hash",
        role: "PASSENGER",
      },
    });

    const token = app.jwt.sign({
      sub: passenger.id,
      role: "PASSENGER",
    });

    const { ride } =
      await createPassengerRideRequest();

    const response = await app.inject({
      method: "POST",
      url: `/driver/requests/${ride.id}/accept`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);

    expect(response.json()).toEqual({
      error: "Forbidden",
    });
  });

  it("rejects an invalid ride ID", async () => {
    const { token } =
      await createDriverWithBullet("ONLINE");

    const response = await app.inject({
      method: "POST",
      url: "/driver/requests/not-a-uuid/accept",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(400);

    expect(response.json()).toEqual({
      error: "Invalid ride ID",
    });
  });

  it("returns 404 for a missing ride request", async () => {
    const { token } =
      await createDriverWithBullet("ONLINE");

    const response = await app.inject({
      method: "POST",
      url:
        "/driver/requests/00000000-0000-4000-8000-000000000000/accept",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(404);

    expect(response.json()).toEqual({
      error: "Ride request not found",
    });
  });

  it("rejects acceptance while the driver is offline", async () => {
    const { token } =
      await createDriverWithBullet("OFFLINE");

    const { ride } =
      await createPassengerRideRequest();

    const response = await app.inject({
      method: "POST",
      url: `/driver/requests/${ride.id}/accept`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      error: "Driver must be online",
    });
  });

  it("rejects a ride request that has already been claimed", async () => {
    const first =
      await createDriverWithBullet("ONLINE");

    const secondDriver = await prisma.user.create({
      data: {
        name: "Karim",
        email: "karim@example.com",
        passwordHash: "test-password-hash",
        role: "DRIVER",
      },
    });

    await prisma.vehicle.create({
      data: {
        name: "Second Tesla",
        capacity: 3,
        status: "ONLINE",
        driverId: secondDriver.id,
      },
    });

    const secondToken = app.jwt.sign({
      sub: secondDriver.id,
      role: "DRIVER",
    });

    const { ride } =
      await createPassengerRideRequest();

    const firstResponse = await app.inject({
      method: "POST",
      url: `/driver/requests/${ride.id}/accept`,
      headers: {
        authorization: `Bearer ${first.token}`,
      },
    });

    expect(firstResponse.statusCode).toBe(200);

    const secondResponse = await app.inject({
      method: "POST",
      url: `/driver/requests/${ride.id}/accept`,
      headers: {
        authorization: `Bearer ${secondToken}`,
      },
    });

    expect(secondResponse.statusCode).toBe(409);

    expect(secondResponse.json()).toEqual({
      error: "Ride request is no longer available",
    });
  });

  it("rejects a request that exceeds Bullet's capacity", async () => {
    const { token } =
      await createDriverWithBullet("ONLINE");

    const passenger = await prisma.user.create({
      data: {
        name: "Large Group",
        email: "large-group@example.com",
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
            seats: 4,
            farePoisha: 20_000,
            status: "REQUESTED",
          },
        },
      },
    });

    const response = await app.inject({
      method: "POST",
      url: `/driver/requests/${ride.id}/accept`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(409);

    expect(response.json()).toEqual({
      error: "Ride request exceeds vehicle capacity",
    });
  });
});
