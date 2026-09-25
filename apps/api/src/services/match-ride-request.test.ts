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

  it("does not match into a ride whose vehicle is offline", async () => {
    const driver = await prisma.user.create({
      data: {
        id: "offline-match-driver",
        name: "Jashim",
        email: "offline-match-driver@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    const existingPassenger = await prisma.user.create({
      data: {
        id: "offline-existing-passenger",
        name: "Nusrat",
        email: "offline-existing@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const requestingPassenger = await prisma.user.create({
      data: {
        id: "offline-requesting-passenger",
        name: "Rafiq",
        email: "offline-requesting@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const bullet = await prisma.vehicle.create({
      data: {
        id: "offline-match-bullet",
        name: "Bullet Offline Matching",
        capacity: 3,
        status: "OFFLINE",
        driverId: driver.id,
      },
    });

    const pooledRide = await prisma.ride.create({
      data: {
        id: "offline-match-pool",
        driverId: driver.id,
        vehicleId: bullet.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "MATCHED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "offline-existing-membership",
        rideId: pooledRide.id,
        passengerId: existingPassenger.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        farePoisha: 8800,
        status: "MATCHED",
      },
    });

    const requestRide = await prisma.ride.create({
      data: {
        id: "offline-request-ride",
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        status: "REQUESTED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "offline-request-membership",
        rideId: requestRide.id,
        passengerId: requestingPassenger.id,
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        seats: 1,
        farePoisha: 10400,
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

    expect(originalRequest?.status).toBe("REQUESTED");

    const passengers = await prisma.ridePassenger.findMany({
      where: {
        rideId: pooledRide.id,
      },
    });

    expect(passengers).toHaveLength(1);
  });

  it("adds a compatible passenger to an accepted pool without regressing its lifecycle", async () => {
    const driver = await prisma.user.create({
      data: {
        id: "accepted-match-driver",
        name: "Jashim",
        email: "accepted-match-driver@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    const existingPassenger = await prisma.user.create({
      data: {
        id: "accepted-existing-passenger",
        name: "Nusrat",
        email: "accepted-existing@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const requestingPassenger = await prisma.user.create({
      data: {
        id: "accepted-requesting-passenger",
        name: "Rafiq",
        email: "accepted-requesting@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const bullet = await prisma.vehicle.create({
      data: {
        id: "accepted-match-bullet",
        name: "Bullet Accepted Matching",
        capacity: 3,
        status: "ONLINE",
        driverId: driver.id,
      },
    });

    const pooledRide = await prisma.ride.create({
      data: {
        id: "accepted-match-pool",
        driverId: driver.id,
        vehicleId: bullet.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "ACCEPTED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "accepted-existing-membership",
        rideId: pooledRide.id,
        passengerId: existingPassenger.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        farePoisha: 8800,
        status: "ACCEPTED",
      },
    });

    const requestRide = await prisma.ride.create({
      data: {
        id: "accepted-request-ride",
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        status: "REQUESTED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "accepted-request-membership",
        rideId: requestRide.id,
        passengerId: requestingPassenger.id,
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        seats: 1,
        farePoisha: 10400,
        status: "REQUESTED",
      },
    });

    const result = await matchRideRequest({
      requestRideId: requestRide.id,
    });

    expect(result).not.toBeNull();
    expect(result?.rideId).toBe(pooledRide.id);
    expect(result?.membership.passengerId).toBe(
      requestingPassenger.id,
    );
    expect(result?.membership.rideId).toBe(pooledRide.id);
    expect(result?.membership.status).toBe("ACCEPTED");
    expect(result?.membership.farePoisha).toBe(10400);

    const acceptedPool = await prisma.ride.findUniqueOrThrow({
      where: {
        id: pooledRide.id,
      },
      include: {
        passengers: true,
      },
    });

    expect(acceptedPool.status).toBe("ACCEPTED");
    expect(acceptedPool.passengers).toHaveLength(2);

    const existingMembership = acceptedPool.passengers.find(
      (passenger) =>
        passenger.passengerId === existingPassenger.id,
    );

    const joinedMembership = acceptedPool.passengers.find(
      (passenger) =>
        passenger.passengerId === requestingPassenger.id,
    );

    expect(existingMembership).toBeDefined();
    expect(existingMembership?.status).toBe("ACCEPTED");
    expect(existingMembership?.farePoisha).toBe(8800);

    expect(joinedMembership).toBeDefined();
    expect(joinedMembership?.status).toBe("ACCEPTED");
    expect(joinedMembership?.pickupZone).toBe("BANANI");
    expect(joinedMembership?.destinationZone).toBe(
      "GULSHAN_1",
    );
    expect(joinedMembership?.farePoisha).toBe(10400);

    const originalRequest = await prisma.ride.findUnique({
      where: {
        id: requestRide.id,
      },
    });

    expect(originalRequest).toBeNull();
  });

  it("prevents concurrent matches from overbooking the last seat in an accepted pool", async () => {
    const driver = await prisma.user.create({
      data: {
        id: "accepted-concurrent-driver",
        name: "Jashim",
        email: "accepted-concurrent-jashim@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    const nusrat = await prisma.user.create({
      data: {
        id: "accepted-concurrent-nusrat",
        name: "Nusrat",
        email: "accepted-concurrent-nusrat@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const rafiq = await prisma.user.create({
      data: {
        id: "accepted-concurrent-rafiq",
        name: "Rafiq",
        email: "accepted-concurrent-rafiq@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const shirin = await prisma.user.create({
      data: {
        id: "accepted-concurrent-shirin",
        name: "Shirin",
        email: "accepted-concurrent-shirin@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const challenger = await prisma.user.create({
      data: {
        id: "accepted-concurrent-challenger",
        name: "Challenger",
        email: "accepted-concurrent-challenger@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const bullet = await prisma.vehicle.create({
      data: {
        id: "accepted-concurrent-bullet",
        name: "Bullet Accepted Concurrent",
        capacity: 3,
        status: "ONLINE",
        driverId: driver.id,
      },
    });

    const pooledRide = await prisma.ride.create({
      data: {
        id: "accepted-concurrent-pool",
        driverId: driver.id,
        vehicleId: bullet.id,
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        status: "ACCEPTED",
      },
    });

    await prisma.ridePassenger.createMany({
      data: [
        {
          id: "accepted-concurrent-nusrat-membership",
          rideId: pooledRide.id,
          passengerId: nusrat.id,
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
          seats: 1,
          farePoisha: 8800,
          status: "ACCEPTED",
        },
        {
          id: "accepted-concurrent-rafiq-membership",
          rideId: pooledRide.id,
          passengerId: rafiq.id,
          pickupZone: "BANANI",
          destinationZone: "GULSHAN_1",
          seats: 1,
          farePoisha: 10400,
          status: "ACCEPTED",
        },
      ],
    });

    const shirinRequest = await prisma.ride.create({
      data: {
        id: "accepted-concurrent-shirin-request",
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        status: "REQUESTED",
      },
    });

    const challengerRequest = await prisma.ride.create({
      data: {
        id: "accepted-concurrent-challenger-request",
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "REQUESTED",
      },
    });

    await prisma.ridePassenger.createMany({
      data: [
        {
          id: "accepted-concurrent-shirin-request-membership",
          rideId: shirinRequest.id,
          passengerId: shirin.id,
          pickupZone: "BANANI",
          destinationZone: "GULSHAN_1",
          seats: 1,
          farePoisha: 10400,
          status: "REQUESTED",
        },
        {
          id: "accepted-concurrent-challenger-request-membership",
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

    const successfulMatches = results.filter(
      (result) =>
        result.status === "fulfilled" &&
        result.value !== null,
    );

    expect(successfulMatches).toHaveLength(1);

    const acceptedPool = await prisma.ride.findUniqueOrThrow({
      where: {
        id: pooledRide.id,
      },
      include: {
        passengers: true,
      },
    });

    expect(acceptedPool.status).toBe("ACCEPTED");
    expect(acceptedPool.passengers).toHaveLength(3);

    const occupiedSeats = acceptedPool.passengers.reduce(
      (total, passenger) => total + passenger.seats,
      0,
    );

    expect(occupiedSeats).toBe(3);

    expect(
      acceptedPool.passengers.every(
        (passenger) => passenger.status === "ACCEPTED",
      ),
    ).toBe(true);

    const joinedContenders = acceptedPool.passengers.filter(
      (passenger) =>
        passenger.passengerId === shirin.id ||
        passenger.passengerId === challenger.id,
    );

    expect(joinedContenders).toHaveLength(1);

    const remainingRequests = await prisma.ride.findMany({
      where: {
        id: {
          in: [
            shirinRequest.id,
            challengerRequest.id,
          ],
        },
      },
      include: {
        passengers: true,
      },
    });

    expect(remainingRequests).toHaveLength(1);
    expect(remainingRequests[0]?.status).toBe("REQUESTED");
    expect(remainingRequests[0]?.passengers).toHaveLength(1);
    expect(
      remainingRequests[0]?.passengers[0]?.status,
    ).toBe("REQUESTED");
  });
});
