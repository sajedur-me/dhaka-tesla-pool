import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { buildApp } from "../app.js";
import { hashPassword } from "../auth/password.js";
import { prisma } from "../db/prisma.js";

describe("passenger routes", () => {
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

  async function createUser(
    role: "PASSENGER" | "DRIVER",
    email: string,
  ) {
    return prisma.user.create({
      data: {
        name:
          role === "PASSENGER"
            ? "Test Passenger"
            : "Test Driver",
        email,
        passwordHash: await hashPassword(
          "SecurePass123!",
        ),
        role,
      },
    });
  }

  function createToken(
    userId: string,
    role: "PASSENGER" | "DRIVER",
  ) {
    return app.jwt.sign({
      sub: userId,
      role,
    });
  }

  async function requestRide(
    token: string,
    destinationZone:
      | "MOHAKHALI"
      | "GULSHAN_1"
      | "GULSHAN_2" = "MOHAKHALI",
  ) {
    return app.inject({
      method: "POST",
      url: "/passenger/rides",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        pickupZone: "BANANI",
        destinationZone,
        seats: 1,
      },
    });
  }

  it("creates a ride request for the authenticated passenger", async () => {
    const passenger = await createUser(
      "PASSENGER",
      "passenger@example.com",
    );

    const token = createToken(
      passenger.id,
      "PASSENGER",
    );

    const response = await requestRide(token);

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.ride).toBeDefined();

    const membership =
      await prisma.ridePassenger.findFirstOrThrow({
        where: {
          passengerId: passenger.id,
        },
        include: {
          ride: true,
        },
      });

    expect(membership.passengerId).toBe(passenger.id);
    expect(membership.pickupZone).toBe("BANANI");
    expect(membership.destinationZone).toBe(
      "MOHAKHALI",
    );
    expect(membership.seats).toBe(1);
    expect(membership.farePoisha).toBe(8800);
    expect(membership.status).toBe("REQUESTED");

    expect(membership.ride.pickupZone).toBe("BANANI");
    expect(membership.ride.destinationZone).toBe(
      "MOHAKHALI",
    );
    expect(membership.ride.status).toBe("REQUESTED");
  });

  it("uses the authenticated passenger identity instead of accepting a passengerId", async () => {
    const passenger = await createUser(
      "PASSENGER",
      "authenticated@example.com",
    );

    const otherPassenger = await createUser(
      "PASSENGER",
      "other@example.com",
    );

    const token = createToken(
      passenger.id,
      "PASSENGER",
    );

    const response = await app.inject({
      method: "POST",
      url: "/passenger/rides",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        passengerId: otherPassenger.id,
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        seats: 1,
      },
    });

    expect(response.statusCode).toBe(201);

    const membership =
      await prisma.ridePassenger.findFirstOrThrow();

    expect(membership.passengerId).toBe(passenger.id);
    expect(membership.passengerId).not.toBe(
      otherPassenger.id,
    );
  });

  it("rejects an unauthenticated ride request", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/passenger/rides",
      payload: {
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
    });
  });

  it("rejects a driver from the passenger ride endpoint", async () => {
    const driver = await createUser(
      "DRIVER",
      "driver@example.com",
    );

    const token = createToken(driver.id, "DRIVER");

    const response = await requestRide(token);

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "Forbidden",
    });
  });

  it("rejects invalid ride request input", async () => {
    const passenger = await createUser(
      "PASSENGER",
      "invalid-input@example.com",
    );

    const token = createToken(
      passenger.id,
      "PASSENGER",
    );

    const response = await app.inject({
      method: "POST",
      url: "/passenger/rides",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        pickupZone: "INVALID_ZONE",
        destinationZone: "MOHAKHALI",
        seats: 0,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe(
      "Invalid request",
    );
  });

  it("rejects a ride with the same pickup and destination", async () => {
    const passenger = await createUser(
      "PASSENGER",
      "same-zone@example.com",
    );

    const token = createToken(
      passenger.id,
      "PASSENGER",
    );

    const response = await app.inject({
      method: "POST",
      url: "/passenger/rides",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        pickupZone: "BANANI",
        destinationZone: "BANANI",
        seats: 1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Pickup and destination must be different",
    });
  });

  it("rejects an unsupported route", async () => {
    const passenger = await createUser(
      "PASSENGER",
      "unsupported@example.com",
    );

    const token = createToken(
      passenger.id,
      "PASSENGER",
    );

    const response = await app.inject({
      method: "POST",
      url: "/passenger/rides",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        pickupZone: "DHANMONDI",
        destinationZone: "UTTARA",
        seats: 1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Unsupported route: DHANMONDI -> UTTARA",
    });
  });

  it("rejects requests for more than Bullet's three-seat capacity", async () => {
    const passenger = await createUser(
      "PASSENGER",
      "capacity@example.com",
    );

    const token = createToken(
      passenger.id,
      "PASSENGER",
    );

    const response = await app.inject({
      method: "POST",
      url: "/passenger/rides",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 4,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe(
      "Invalid request",
    );
  });

  it("returns only the authenticated passenger's ride history", async () => {
    const nusrat = await createUser(
      "PASSENGER",
      "nusrat@example.com",
    );

    const rafiq = await createUser(
      "PASSENGER",
      "rafiq@example.com",
    );

    const nusratToken = createToken(
      nusrat.id,
      "PASSENGER",
    );

    const rafiqToken = createToken(
      rafiq.id,
      "PASSENGER",
    );

    await requestRide(nusratToken, "MOHAKHALI");
    await requestRide(rafiqToken, "GULSHAN_1");

    const response = await app.inject({
      method: "GET",
      url: "/passenger/rides",
      headers: {
        authorization: `Bearer ${nusratToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.rides).toHaveLength(1);
    expect(body.rides[0].destinationZone).toBe(
      "MOHAKHALI",
    );
    expect(body.rides[0].farePoisha).toBe(8800);

    const rafiqMembership =
      await prisma.ridePassenger.findFirstOrThrow({
        where: {
          passengerId: rafiq.id,
        },
      });

    expect(body.rides[0].rideId).not.toBe(
      rafiqMembership.rideId,
    );
  });

  it("returns the authenticated passenger's own ride details", async () => {
    const passenger = await createUser(
      "PASSENGER",
      "details@example.com",
    );

    const token = createToken(
      passenger.id,
      "PASSENGER",
    );

    await requestRide(token, "GULSHAN_1");

    const membership =
      await prisma.ridePassenger.findFirstOrThrow({
        where: {
          passengerId: passenger.id,
        },
      });

    const response = await app.inject({
      method: "GET",
      url: `/passenger/rides/${membership.rideId}`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.ride.rideId).toBe(
      membership.rideId,
    );
    expect(body.ride.pickupZone).toBe("BANANI");
    expect(body.ride.destinationZone).toBe(
      "GULSHAN_1",
    );
    expect(body.ride.farePoisha).toBe(10400);
    expect(body.ride.status).toBe("REQUESTED");

    expect(body.ride).not.toHaveProperty(
      "passengerId",
    );
  });

  it("does not expose another passenger's private ride", async () => {
    const nusrat = await createUser(
      "PASSENGER",
      "private-nusrat@example.com",
    );

    const rafiq = await createUser(
      "PASSENGER",
      "private-rafiq@example.com",
    );

    const nusratToken = createToken(
      nusrat.id,
      "PASSENGER",
    );

    const rafiqToken = createToken(
      rafiq.id,
      "PASSENGER",
    );

    await requestRide(rafiqToken, "GULSHAN_1");

    const rafiqMembership =
      await prisma.ridePassenger.findFirstOrThrow({
        where: {
          passengerId: rafiq.id,
        },
      });

    const response = await app.inject({
      method: "GET",
      url: `/passenger/rides/${rafiqMembership.rideId}`,
      headers: {
        authorization: `Bearer ${nusratToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Ride not found",
    });
  });

  it("allows a passenger to cancel their own requested ride", async () => {
    const passenger = await createUser(
      "PASSENGER",
      "cancel@example.com",
    );

    const token = createToken(
      passenger.id,
      "PASSENGER",
    );

    await requestRide(token);

    const membership =
      await prisma.ridePassenger.findFirstOrThrow({
        where: {
          passengerId: passenger.id,
        },
      });

    const response = await app.inject({
      method: "POST",
      url: `/passenger/rides/${membership.rideId}/cancel`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const updatedMembership =
      await prisma.ridePassenger.findUniqueOrThrow({
        where: {
          id: membership.id,
        },
      });

    const updatedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: membership.rideId,
        },
      });

    expect(updatedMembership.status).toBe(
      "CANCELLED",
    );
    expect(updatedMembership.cancelledAt).not.toBeNull();
    expect(updatedRide.status).toBe("CANCELLED");
    expect(updatedRide.cancelledAt).not.toBeNull();
  });

  it("does not allow a passenger to cancel another passenger's ride", async () => {
    const nusrat = await createUser(
      "PASSENGER",
      "cancel-nusrat@example.com",
    );

    const rafiq = await createUser(
      "PASSENGER",
      "cancel-rafiq@example.com",
    );

    const nusratToken = createToken(
      nusrat.id,
      "PASSENGER",
    );

    const rafiqToken = createToken(
      rafiq.id,
      "PASSENGER",
    );

    await requestRide(rafiqToken);

    const rafiqMembership =
      await prisma.ridePassenger.findFirstOrThrow({
        where: {
          passengerId: rafiq.id,
        },
      });

    const response = await app.inject({
      method: "POST",
      url: `/passenger/rides/${rafiqMembership.rideId}/cancel`,
      headers: {
        authorization: `Bearer ${nusratToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Ride not found",
    });

    const unchangedMembership =
      await prisma.ridePassenger.findUniqueOrThrow({
        where: {
          id: rafiqMembership.id,
        },
      });

    expect(unchangedMembership.status).toBe(
      "REQUESTED",
    );
  });

  it("rejects an invalid ride ID", async () => {
    const passenger = await createUser(
      "PASSENGER",
      "invalid-id@example.com",
    );

    const token = createToken(
      passenger.id,
      "PASSENGER",
    );

    const response = await app.inject({
      method: "GET",
      url: "/passenger/rides/not-a-uuid",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Invalid ride ID",
    });
  });
});
