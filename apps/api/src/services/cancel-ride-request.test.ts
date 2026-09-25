import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../db/prisma.js";
import { cancelRideRequest } from "./cancel-ride-request.js";
import { transitionRide } from "./transition-ride.js";

describe("cancelRideRequest", () => {
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

  it("cancels a passenger request and its empty parent ride", async () => {
    const passenger = await prisma.user.create({
      data: {
        id: "cancel-single-passenger",
        name: "Nusrat",
        email: "cancel-single@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        id: "cancel-single-ride",
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "REQUESTED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "cancel-single-membership",
        rideId: ride.id,
        passengerId: passenger.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        farePoisha: 8800,
        status: "REQUESTED",
      },
    });

    const cancelled = await cancelRideRequest({
      passengerId: passenger.id,
      rideId: ride.id,
    });

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();

    const updatedRide = await prisma.ride.findUnique({
      where: {
        id: ride.id,
      },
    });

    expect(updatedRide?.status).toBe("CANCELLED");
    expect(updatedRide?.cancelledAt).not.toBeNull();
  });

  it("keeps a pooled ride active when another passenger remains", async () => {
    const nusrat = await prisma.user.create({
      data: {
        id: "cancel-pool-nusrat",
        name: "Nusrat",
        email: "cancel-pool-nusrat@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const rafiq = await prisma.user.create({
      data: {
        id: "cancel-pool-rafiq",
        name: "Rafiq",
        email: "cancel-pool-rafiq@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        id: "cancel-pooled-ride",
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        status: "MATCHED",
      },
    });

    await prisma.ridePassenger.createMany({
      data: [
        {
          id: "cancel-pool-nusrat-membership",
          rideId: ride.id,
          passengerId: nusrat.id,
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
          seats: 1,
          farePoisha: 8800,
          status: "MATCHED",
        },
        {
          id: "cancel-pool-rafiq-membership",
          rideId: ride.id,
          passengerId: rafiq.id,
          pickupZone: "BANANI",
          destinationZone: "GULSHAN_1",
          seats: 1,
          farePoisha: 10400,
          status: "MATCHED",
        },
      ],
    });

    await cancelRideRequest({
      passengerId: rafiq.id,
      rideId: ride.id,
    });

    const updatedRide = await prisma.ride.findUnique({
      where: {
        id: ride.id,
      },
    });

    expect(updatedRide?.status).toBe("MATCHED");

    const nusratMembership = await prisma.ridePassenger.findFirst({
      where: {
        rideId: ride.id,
        passengerId: nusrat.id,
      },
    });

    expect(nusratMembership?.status).toBe("MATCHED");
  });

  it("rejects cancellation after the passenger ride has started", async () => {
    const passenger = await prisma.user.create({
      data: {
        id: "cancel-started-passenger",
        name: "Nusrat",
        email: "cancel-started@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        id: "cancel-started-ride",
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "STARTED",
        startedAt: new Date(),
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "cancel-started-membership",
        rideId: ride.id,
        passengerId: passenger.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        farePoisha: 8800,
        status: "STARTED",
      },
    });

    await expect(
      cancelRideRequest({
        passengerId: passenger.id,
        rideId: ride.id,
      }),
    ).rejects.toThrow(
      "Ride request cannot be cancelled in its current state",
    );
  });

  it("releases cancelled seats from active capacity", async () => {
    const passenger = await prisma.user.create({
      data: {
        id: "cancel-seat-passenger",
        name: "Shirin",
        email: "cancel-seat@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        id: "cancel-seat-ride",
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        status: "MATCHED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "cancel-seat-membership",
        rideId: ride.id,
        passengerId: passenger.id,
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        seats: 1,
        farePoisha: 10400,
        status: "MATCHED",
      },
    });

    await cancelRideRequest({
      passengerId: passenger.id,
      rideId: ride.id,
    });

    const activeSeats = await prisma.ridePassenger.aggregate({
      _sum: {
        seats: true,
      },
      where: {
        rideId: ride.id,
        status: {
          in: [
            "REQUESTED",
            "MATCHED",
            "ACCEPTED",
            "DRIVER_ARRIVED",
            "STARTED",
          ],
        },
      },
    });

    expect(activeSeats._sum.seats ?? 0).toBe(0);
  });

  it("serializes passenger cancellation against a concurrent driver transition", async () => {
    const driver = await prisma.user.create({
      data: {
        id: "cancel-race-driver",
        name: "Jashim",
        email: "cancel-race-driver@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    const passenger = await prisma.user.create({
      data: {
        id: "cancel-race-passenger",
        name: "Nusrat",
        email: "cancel-race-passenger@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        id: "cancel-race-ride",
        driverId: driver.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "ACCEPTED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "cancel-race-membership",
        rideId: ride.id,
        passengerId: passenger.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        farePoisha: 8800,
        status: "ACCEPTED",
      },
    });

    const results = await Promise.allSettled([
      cancelRideRequest({
        passengerId: passenger.id,
        rideId: ride.id,
      }),
      transitionRide({
        rideId: ride.id,
        driverId: driver.id,
        nextStatus: "DRIVER_ARRIVED",
      }),
    ]);

    expect(results).toHaveLength(2);

    const finalRide = await prisma.ride.findUniqueOrThrow({
      where: {
        id: ride.id,
      },
    });

    const finalMembership =
      await prisma.ridePassenger.findUniqueOrThrow({
        where: {
          id: "cancel-race-membership",
        },
      });

    const isCancelledOutcome =
      finalRide.status === "CANCELLED" &&
      finalMembership.status === "CANCELLED" &&
      finalRide.cancelledAt !== null &&
      finalMembership.cancelledAt !== null;

    const isDriverArrivedOutcome =
      finalRide.status === "DRIVER_ARRIVED" &&
      finalMembership.status === "DRIVER_ARRIVED" &&
      finalRide.cancelledAt === null &&
      finalMembership.cancelledAt === null;

    expect(
      isCancelledOutcome || isDriverArrivedOutcome,
    ).toBe(true);
  });
});
