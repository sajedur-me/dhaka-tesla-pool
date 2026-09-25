import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../db/prisma.js";
import { reserveSeats } from "./reserve-seats.js";

describe("reserveSeats", () => {
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

  it("reserves available seats without exceeding vehicle capacity", async () => {
    const driver = await prisma.user.create({
      data: {
        id: "driver-bullet",
        name: "Bullet Driver",
        email: "bullet-driver@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    const passengerOne = await prisma.user.create({
      data: {
        id: "passenger-one",
        name: "Passenger One",
        email: "passenger-one@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const passengerTwo = await prisma.user.create({
      data: {
        id: "passenger-two",
        name: "Passenger Two",
        email: "passenger-two@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const passengerThree = await prisma.user.create({
      data: {
        id: "passenger-three",
        name: "Passenger Three",
        email: "passenger-three@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        id: "vehicle-bullet",
        name: "Bullet",
        capacity: 3,
        driverId: driver.id,
        status: "ONLINE",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        id: "ride-bullet",
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "REQUESTED",
      },
    });

    await prisma.ridePassenger.createMany({
      data: [
        {
          id: "existing-passenger-one",
          rideId: ride.id,
          passengerId: passengerOne.id,
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
          seats: 1,
          farePoisha: 5000,
          status: "ACCEPTED",
        },
        {
          id: "existing-passenger-two",
          rideId: ride.id,
          passengerId: passengerTwo.id,
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
          seats: 1,
          farePoisha: 5000,
          status: "ACCEPTED",
        },
      ],
    });

    const reservation = await reserveSeats({
      rideId: ride.id,
      passengerId: passengerThree.id,
      seats: 1,
      farePoisha: 4000,
    });

    expect(reservation.passengerId).toBe(passengerThree.id);
    expect(reservation.seats).toBe(1);

    await expect(
      reserveSeats({
        rideId: ride.id,
        passengerId: passengerOne.id,
        seats: 1,
        farePoisha: 4000,
      }),
    ).rejects.toThrow("Not enough seats available");
  });

  it("allows only one concurrent request to claim the last seat", async () => {
    const driver = await prisma.user.create({
      data: {
        id: "driver-concurrent",
        name: "Concurrent Driver",
        email: "concurrent-driver@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    const existingPassengerOne = await prisma.user.create({
      data: {
        id: "concurrent-existing-passenger-one",
        name: "Existing Passenger One",
        email: "concurrent-existing-one@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const existingPassengerTwo = await prisma.user.create({
      data: {
        id: "concurrent-existing-passenger-two",
        name: "Existing Passenger Two",
        email: "concurrent-existing-two@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const passengerOne = await prisma.user.create({
      data: {
        id: "concurrent-passenger-one",
        name: "Concurrent Passenger One",
        email: "concurrent-one@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const passengerTwo = await prisma.user.create({
      data: {
        id: "concurrent-passenger-two",
        name: "Concurrent Passenger Two",
        email: "concurrent-two@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        id: "vehicle-concurrent",
        name: "Bullet Concurrent",
        capacity: 3,
        driverId: driver.id,
        status: "ONLINE",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        id: "ride-concurrent",
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "REQUESTED",
      },
    });

    await prisma.ridePassenger.createMany({
      data: [
        {
          id: "concurrent-existing-seat-one",
          rideId: ride.id,
          passengerId: existingPassengerOne.id,
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
          seats: 1,
          farePoisha: 5000,
          status: "ACCEPTED",
        },
        {
          id: "concurrent-existing-seat-two",
          rideId: ride.id,
          passengerId: existingPassengerTwo.id,
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
          seats: 1,
          farePoisha: 5000,
          status: "ACCEPTED",
        },
      ],
    });

    const results = await Promise.allSettled([
      reserveSeats({
        rideId: ride.id,
        passengerId: passengerOne.id,
        seats: 1,
        farePoisha: 4000,
      }),
      reserveSeats({
        rideId: ride.id,
        passengerId: passengerTwo.id,
        seats: 1,
        farePoisha: 4000,
      }),
    ]);

    const successfulReservations = results.filter(
      (result) => result.status === "fulfilled",
    );

    const rejectedReservations = results.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof Error &&
        result.reason.message === "Not enough seats available",
    );

    expect(successfulReservations).toHaveLength(1);
    expect(rejectedReservations).toHaveLength(1);

    const reservations = await prisma.ridePassenger.findMany({
      where: {
        rideId: ride.id,
      },
    });

    const totalSeats = reservations.reduce(
      (total, reservation) => total + reservation.seats,
      0,
    );

    expect(totalSeats).toBe(3);
  });
});
