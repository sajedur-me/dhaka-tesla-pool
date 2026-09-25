import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../db/prisma.js";
import { createRideRequest } from "./create-ride-request.js";

describe("createRideRequest", () => {
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

  it("creates a requested ride with the passenger route and fare", async () => {
    const passenger = await prisma.user.create({
      data: {
        id: "request-passenger",
        name: "Nusrat",
        email: "nusrat@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const result = await createRideRequest({
      passengerId: passenger.id,
      pickupZone: "BANANI",
      destinationZone: "MOHAKHALI",
      seats: 1,
      estimatedFarePoisha: 8800,
    });

    expect(result.ride.status).toBe("REQUESTED");
    expect(result.ride.pickupZone).toBe("BANANI");
    expect(result.ride.destinationZone).toBe("MOHAKHALI");

    expect(result.membership.passengerId).toBe(passenger.id);
    expect(result.membership.pickupZone).toBe("BANANI");
    expect(result.membership.destinationZone).toBe("MOHAKHALI");
    expect(result.membership.seats).toBe(1);
    expect(result.membership.farePoisha).toBe(8800);
    expect(result.membership.status).toBe("REQUESTED");
  });

  it("rejects a driver trying to create a passenger ride request", async () => {
    const driver = await prisma.user.create({
      data: {
        id: "request-driver",
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    await expect(
      createRideRequest({
        passengerId: driver.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        estimatedFarePoisha: 8800,
      }),
    ).rejects.toThrow("Only passengers can request rides");
  });

  it("rejects a request for an unknown passenger", async () => {
    await expect(
      createRideRequest({
        passengerId: "missing-passenger",
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        estimatedFarePoisha: 8800,
      }),
    ).rejects.toThrow("Passenger not found");
  });

  it("rejects a request with the same pickup and destination", async () => {
    await expect(
      createRideRequest({
        passengerId: "unused-passenger",
        pickupZone: "BANANI",
        destinationZone: "BANANI",
        seats: 1,
        estimatedFarePoisha: 8800,
      }),
    ).rejects.toThrow("Pickup and destination must be different");
  });

  it("rejects an invalid seat count", async () => {
    await expect(
      createRideRequest({
        passengerId: "unused-passenger",
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 0,
        estimatedFarePoisha: 8800,
      }),
    ).rejects.toThrow("Seats must be greater than zero");
  });

  it("rejects an invalid estimated fare", async () => {
    await expect(
      createRideRequest({
        passengerId: "unused-passenger",
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        estimatedFarePoisha: -1,
      }),
    ).rejects.toThrow("Fare must be a non-negative integer");
  });
});
