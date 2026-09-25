import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../db/prisma.js";
import { matchRideRequest } from "./match-ride-request.js";

describe("matchRideRequest", () => {
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

  it("matches a compatible passenger into an existing pooled ride", async () => {
    const driver = await prisma.user.create({
      data: {
        id: "matching-driver",
        name: "Jashim",
        email: "matching-jashim@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    const nusrat = await prisma.user.create({
      data: {
        id: "matching-nusrat",
        name: "Nusrat",
        email: "matching-nusrat@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const rafiq = await prisma.user.create({
      data: {
        id: "matching-rafiq",
        name: "Rafiq",
        email: "matching-rafiq@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const bullet = await prisma.vehicle.create({
      data: {
        id: "matching-bullet",
        name: "Bullet Matching",
        capacity: 3,
        status: "ONLINE",
        driverId: driver.id,
      },
    });

    const pooledRide = await prisma.ride.create({
      data: {
        id: "nusrat-pooled-ride",
        driverId: driver.id,
        vehicleId: bullet.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "REQUESTED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "nusrat-membership",
        rideId: pooledRide.id,
        passengerId: nusrat.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        farePoisha: 8800,
        status: "REQUESTED",
      },
    });

    const rafiqRequest = await prisma.ride.create({
      data: {
        id: "rafiq-request-ride",
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        status: "REQUESTED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "rafiq-request-membership",
        rideId: rafiqRequest.id,
        passengerId: rafiq.id,
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        seats: 1,
        farePoisha: 10400,
        status: "REQUESTED",
      },
    });

    const result = await matchRideRequest({
      requestRideId: rafiqRequest.id,
    });

    expect(result).not.toBeNull();
    expect(result?.rideId).toBe(pooledRide.id);
    expect(result?.membership.passengerId).toBe(rafiq.id);
    expect(result?.membership.destinationZone).toBe("GULSHAN_1");
    expect(result?.membership.farePoisha).toBe(10400);
    expect(result?.membership.status).toBe("MATCHED");

    const passengers = await prisma.ridePassenger.findMany({
      where: {
        rideId: pooledRide.id,
      },
      orderBy: {
        passengerId: "asc",
      },
    });

    expect(passengers).toHaveLength(2);

    const updatedPool = await prisma.ride.findUnique({
      where: {
        id: pooledRide.id,
      },
    });

    expect(updatedPool?.status).toBe("MATCHED");

    const originalRequest = await prisma.ride.findUnique({
      where: {
        id: rafiqRequest.id,
      },
    });

    expect(originalRequest).toBeNull();
  });

  it("does not match an incompatible route", async () => {
    const driver = await prisma.user.create({
      data: {
        id: "incompatible-driver",
        name: "Jashim",
        email: "incompatible-jashim@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    const existingPassenger = await prisma.user.create({
      data: {
        id: "incompatible-existing-passenger",
        name: "Nusrat",
        email: "incompatible-nusrat@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const requestingPassenger = await prisma.user.create({
      data: {
        id: "incompatible-requesting-passenger",
        name: "Rafiq",
        email: "incompatible-rafiq@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const bullet = await prisma.vehicle.create({
      data: {
        id: "incompatible-bullet",
        name: "Bullet Incompatible",
        capacity: 3,
        status: "ONLINE",
        driverId: driver.id,
      },
    });

    const pooledRide = await prisma.ride.create({
      data: {
        id: "incompatible-pooled-ride",
        driverId: driver.id,
        vehicleId: bullet.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "REQUESTED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "incompatible-existing-membership",
        rideId: pooledRide.id,
        passengerId: existingPassenger.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        farePoisha: 8800,
        status: "REQUESTED",
      },
    });

    const requestRide = await prisma.ride.create({
      data: {
        id: "incompatible-request-ride",
        pickupZone: "MIRPUR",
        destinationZone: "DHANMONDI",
        status: "REQUESTED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "incompatible-request-membership",
        rideId: requestRide.id,
        passengerId: requestingPassenger.id,
        pickupZone: "MIRPUR",
        destinationZone: "DHANMONDI",
        seats: 1,
        farePoisha: 12000,
        status: "REQUESTED",
      },
    });

    const result = await matchRideRequest({
      requestRideId: requestRide.id,
    });

    expect(result).toBeNull();

    const originalRequest = await prisma.ride.findUnique({
      where: {
        id: requestRide.id,
      },
    });

    expect(originalRequest).not.toBeNull();
    expect(originalRequest?.status).toBe("REQUESTED");
  });

  it("prevents concurrent matches from overbooking the last seat", async () => {
    const driver = await prisma.user.create({
      data: {
        id: "concurrent-match-driver",
        name: "Jashim",
        email: "concurrent-match-jashim@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    const nusrat = await prisma.user.create({
      data: {
        id: "concurrent-match-nusrat",
        name: "Nusrat",
        email: "concurrent-match-nusrat@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const rafiq = await prisma.user.create({
      data: {
        id: "concurrent-match-rafiq",
        name: "Rafiq",
        email: "concurrent-match-rafiq@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const shirin = await prisma.user.create({
      data: {
        id: "concurrent-match-shirin",
        name: "Shirin",
        email: "concurrent-match-shirin@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const challenger = await prisma.user.create({
      data: {
        id: "concurrent-match-challenger",
        name: "Challenger",
        email: "concurrent-match-challenger@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const bullet = await prisma.vehicle.create({
      data: {
        id: "concurrent-match-bullet",
        name: "Bullet Concurrent Matching",
        capacity: 3,
        status: "ONLINE",
        driverId: driver.id,
      },
    });

    const pooledRide = await prisma.ride.create({
      data: {
        id: "concurrent-match-pool",
        driverId: driver.id,
        vehicleId: bullet.id,
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        status: "MATCHED",
      },
    });

    await prisma.ridePassenger.createMany({
      data: [
        {
          id: "concurrent-match-nusrat-membership",
          rideId: pooledRide.id,
          passengerId: nusrat.id,
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
          seats: 1,
          farePoisha: 8800,
          status: "MATCHED",
        },
        {
          id: "concurrent-match-rafiq-membership",
          rideId: pooledRide.id,
          passengerId: rafiq.id,
          pickupZone: "BANANI",
          destinationZone: "GULSHAN_1",
          seats: 1,
          farePoisha: 10400,
          status: "MATCHED",
        },
      ],
    });

    const shirinRequest = await prisma.ride.create({
      data: {
        id: "concurrent-match-shirin-request",
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        status: "REQUESTED",
      },
    });

    const challengerRequest = await prisma.ride.create({
      data: {
        id: "concurrent-match-challenger-request",
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "REQUESTED",
      },
    });

    await prisma.ridePassenger.createMany({
      data: [
        {
          id: "concurrent-match-shirin-request-membership",
          rideId: shirinRequest.id,
          passengerId: shirin.id,
          pickupZone: "BANANI",
          destinationZone: "GULSHAN_1",
          seats: 1,
          farePoisha: 10400,
          status: "REQUESTED",
        },
        {
          id: "concurrent-match-challenger-request-membership",
          rideId: challengerRequest.id,
          passengerId: challenger.id,
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
          seats: 1,
          farePoisha: 8800,
          status: "REQUESTED",
        },
      ],
    });

    const results = await Promise.allSettled([
      matchRideRequest({
        requestRideId: shirinRequest.id,
      }),
      matchRideRequest({
        requestRideId: challengerRequest.id,
      }),
    ]);

    const matchedResults = results.filter(
      (result) =>
        result.status === "fulfilled" &&
        result.value !== null,
    );

    expect(matchedResults).toHaveLength(1);

    const pooledPassengers = await prisma.ridePassenger.findMany({
      where: {
        rideId: pooledRide.id,
      },
    });

    const occupiedSeats = pooledPassengers.reduce(
      (total, passenger) => total + passenger.seats,
      0,
    );

    expect(occupiedSeats).toBe(3);
    expect(pooledPassengers).toHaveLength(3);
  });
});
