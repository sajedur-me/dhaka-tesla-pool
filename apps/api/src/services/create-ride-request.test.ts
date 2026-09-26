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

  it("creates a requested ride and calculates the pooled fare on the server", async () => {
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

  it("calculates a different fare for a longer supported route", async () => {
    const passenger = await prisma.user.create({
      data: {
        id: "longer-route-passenger",
        name: "Rafiq",
        email: "rafiq-request@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const result = await createRideRequest({
      passengerId: passenger.id,
      pickupZone: "BANANI",
      destinationZone: "GULSHAN_1",
      seats: 1,
    });

    expect(result.membership.farePoisha).toBe(10400);
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
      }),
    ).rejects.toThrow("Seats must be greater than zero");
  });

  it("rejects an unsupported route", async () => {
    await expect(
      createRideRequest({
        passengerId: "unused-passenger",
        pickupZone: "DHANMONDI",
        destinationZone: "UTTARA",
        seats: 1,
      }),
    ).rejects.toThrow(
      "Unsupported route: DHANMONDI -> UTTARA",
    );
  });

  it("prevents production ride requests from overbooking the final pooled seat concurrently", async () => {
    const driver = await prisma.user.create({
      data: {
        id: "production-concurrency-driver",
        name: "Jashim",
        email: "production-concurrency-jashim@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    const nusrat = await prisma.user.create({
      data: {
        id: "production-concurrency-nusrat",
        name: "Nusrat",
        email: "production-concurrency-nusrat@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const rafiq = await prisma.user.create({
      data: {
        id: "production-concurrency-rafiq",
        name: "Rafiq",
        email: "production-concurrency-rafiq@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const shirin = await prisma.user.create({
      data: {
        id: "production-concurrency-shirin",
        name: "Shirin",
        email: "production-concurrency-shirin@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const challenger = await prisma.user.create({
      data: {
        id: "production-concurrency-challenger",
        name: "Challenger",
        email: "production-concurrency-challenger@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const bullet = await prisma.vehicle.create({
      data: {
        id: "production-concurrency-bullet",
        name: "Bullet Production Concurrency",
        capacity: 3,
        status: "ONLINE",
        driverId: driver.id,
      },
    });

    const acceptedPool = await prisma.ride.create({
      data: {
        id: "production-concurrency-pool",
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
          id: "production-concurrency-nusrat-membership",
          rideId: acceptedPool.id,
          passengerId: nusrat.id,
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
          seats: 1,
          farePoisha: 8_800,
          status: "ACCEPTED",
        },
        {
          id: "production-concurrency-rafiq-membership",
          rideId: acceptedPool.id,
          passengerId: rafiq.id,
          pickupZone: "BANANI",
          destinationZone: "GULSHAN_1",
          seats: 1,
          farePoisha: 10_400,
          status: "ACCEPTED",
        },
      ],
    });

    const results = await Promise.all([
      createRideRequest({
        passengerId: shirin.id,
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        seats: 1,
      }),
      createRideRequest({
        passengerId: challenger.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
      }),
    ]);

    const storedPool = await prisma.ride.findUniqueOrThrow({
      where: {
        id: acceptedPool.id,
      },
      include: {
        passengers: true,
      },
    });

    expect(storedPool.status).toBe("ACCEPTED");
    expect(storedPool.passengers).toHaveLength(3);

    const occupiedSeats = storedPool.passengers.reduce(
      (total, passenger) => total + passenger.seats,
      0,
    );

    expect(occupiedSeats).toBe(3);

    const joinedContenders = storedPool.passengers.filter(
      (passenger) =>
        passenger.passengerId === shirin.id ||
        passenger.passengerId === challenger.id,
    );

    expect(joinedContenders).toHaveLength(1);

    const joinedPassengerId =
      joinedContenders[0]?.passengerId;

    const unmatchedPassengerId =
      joinedPassengerId === shirin.id
        ? challenger.id
        : shirin.id;

    const unmatchedResult = results.find(
      (result) =>
        result.membership.passengerId === unmatchedPassengerId,
    );

    expect(unmatchedResult).toBeDefined();

    if (!unmatchedResult) {
      throw new Error(
        "Expected one contender to remain unmatched",
      );
    }

    expect(unmatchedResult.ride.status).toBe("REQUESTED");
    expect(unmatchedResult.membership.status).toBe("REQUESTED");

    const unmatchedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: unmatchedResult.ride.id,
        },
        include: {
          passengers: true,
        },
      });

    expect(unmatchedRide.driverId).toBeNull();
    expect(unmatchedRide.vehicleId).toBeNull();
    expect(unmatchedRide.passengers).toHaveLength(1);
    expect(unmatchedRide.passengers[0]?.passengerId).toBe(
      unmatchedPassengerId,
    );
    expect(unmatchedRide.passengers[0]?.status).toBe(
      "REQUESTED",
    );

    const contenderMemberships =
      await prisma.ridePassenger.findMany({
        where: {
          passengerId: {
            in: [shirin.id, challenger.id],
          },
        },
      });

    expect(contenderMemberships).toHaveLength(2);

    const totalSeatsAssignedToPool =
      await prisma.ridePassenger.aggregate({
        where: {
          rideId: acceptedPool.id,
          status: "ACCEPTED",
        },
        _sum: {
          seats: true,
        },
      });

    expect(totalSeatsAssignedToPool._sum.seats).toBe(3);
  });

});
