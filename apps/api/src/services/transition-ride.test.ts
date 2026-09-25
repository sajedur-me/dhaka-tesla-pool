import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../db/prisma.js";
import { transitionRide } from "./transition-ride.js";

describe("transitionRide", () => {
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

  async function createDriver(id: string, email: string) {
    return prisma.user.create({
      data: {
        id,
        name: "Jashim",
        email,
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });
  }

  it("moves an assigned pooled ride and its active passengers through the lifecycle while synchronizing the vehicle", async () => {
    const driver = await createDriver(
      "transition-driver",
      "transition-driver@example.com",
    );

    const vehicle = await prisma.vehicle.create({
      data: {
        id: "transition-bullet",
        name: "Bullet Transition",
        capacity: 3,
        status: "ONLINE",
        driverId: driver.id,
      },
    });

    const nusrat = await prisma.user.create({
      data: {
        id: "transition-nusrat",
        name: "Nusrat",
        email: "transition-nusrat@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const rafiq = await prisma.user.create({
      data: {
        id: "transition-rafiq",
        name: "Rafiq",
        email: "transition-rafiq@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        id: "transition-pooled-ride",
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        status: "MATCHED",
      },
    });

    await prisma.ridePassenger.createMany({
      data: [
        {
          id: "transition-nusrat-membership",
          rideId: ride.id,
          passengerId: nusrat.id,
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
          seats: 1,
          farePoisha: 8800,
          status: "MATCHED",
        },
        {
          id: "transition-rafiq-membership",
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

    await transitionRide({
      rideId: ride.id,
      driverId: driver.id,
      nextStatus: "ACCEPTED",
    });

    let currentVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: {
        id: vehicle.id,
      },
    });

    expect(currentVehicle.status).toBe("ONLINE");

    await transitionRide({
      rideId: ride.id,
      driverId: driver.id,
      nextStatus: "DRIVER_ARRIVED",
    });

    currentVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: {
        id: vehicle.id,
      },
    });

    expect(currentVehicle.status).toBe("ONLINE");

    await transitionRide({
      rideId: ride.id,
      driverId: driver.id,
      nextStatus: "STARTED",
    });

    const startedRide = await prisma.ride.findUniqueOrThrow({
      where: {
        id: ride.id,
      },
    });

    currentVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: {
        id: vehicle.id,
      },
    });

    expect(startedRide.status).toBe("STARTED");
    expect(startedRide.startedAt).not.toBeNull();
    expect(currentVehicle.status).toBe("ON_RIDE");

    await transitionRide({
      rideId: ride.id,
      driverId: driver.id,
      nextStatus: "COMPLETED",
    });

    const completedRide = await prisma.ride.findUniqueOrThrow({
      where: {
        id: ride.id,
      },
    });

    currentVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: {
        id: vehicle.id,
      },
    });

    expect(completedRide.status).toBe("COMPLETED");
    expect(completedRide.completedAt).not.toBeNull();
    expect(currentVehicle.status).toBe("ONLINE");

    const passengers = await prisma.ridePassenger.findMany({
      where: {
        rideId: ride.id,
      },
    });

    expect(passengers).toHaveLength(2);
    expect(
      passengers.every(
        (passenger) => passenger.status === "COMPLETED",
      ),
    ).toBe(true);
  });

  it("rejects an invalid lifecycle jump", async () => {
    const driver = await createDriver(
      "transition-invalid-driver",
      "transition-invalid-driver@example.com",
    );

    const ride = await prisma.ride.create({
      data: {
        id: "transition-invalid-ride",
        driverId: driver.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "MATCHED",
      },
    });

    await expect(
      transitionRide({
        rideId: ride.id,
        driverId: driver.id,
        nextStatus: "STARTED",
      }),
    ).rejects.toThrow(
      "Invalid driver ride transition: MATCHED -> STARTED",
    );

    const unchangedRide = await prisma.ride.findUniqueOrThrow({
      where: {
        id: ride.id,
      },
    });

    expect(unchangedRide.status).toBe("MATCHED");
    expect(unchangedRide.startedAt).toBeNull();
  });

  it("rejects a driver attempting to cancel a ride", async () => {
    const driver = await createDriver(
      "transition-cancel-driver",
      "transition-cancel-driver@example.com",
    );

    const ride = await prisma.ride.create({
      data: {
        id: "transition-driver-cancel-ride",
        driverId: driver.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "MATCHED",
      },
    });

    await expect(
      transitionRide({
        rideId: ride.id,
        driverId: driver.id,
        nextStatus: "CANCELLED",
      }),
    ).rejects.toThrow(
      "Invalid driver ride transition: MATCHED -> CANCELLED",
    );

    const unchangedRide = await prisma.ride.findUniqueOrThrow({
      where: {
        id: ride.id,
      },
    });

    expect(unchangedRide.status).toBe("MATCHED");
    expect(unchangedRide.cancelledAt).toBeNull();
  });

  it("does not reactivate a cancelled passenger during ride transitions", async () => {
    const driver = await createDriver(
      "transition-cancelled-driver",
      "transition-cancelled-driver@example.com",
    );

    const vehicle = await prisma.vehicle.create({
      data: {
        id: "transition-cancelled-bullet",
        name: "Bullet Cancelled Passenger",
        capacity: 3,
        status: "ONLINE",
        driverId: driver.id,
      },
    });

    const nusrat = await prisma.user.create({
      data: {
        id: "transition-active-passenger",
        name: "Nusrat",
        email: "transition-active@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const shirin = await prisma.user.create({
      data: {
        id: "transition-cancelled-passenger",
        name: "Shirin",
        email: "transition-cancelled@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        id: "transition-cancelled-member-ride",
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "GULSHAN_1",
        status: "ACCEPTED",
      },
    });

    await prisma.ridePassenger.createMany({
      data: [
        {
          id: "transition-active-membership",
          rideId: ride.id,
          passengerId: nusrat.id,
          pickupZone: "BANANI",
          destinationZone: "MOHAKHALI",
          seats: 1,
          farePoisha: 8800,
          status: "ACCEPTED",
        },
        {
          id: "transition-cancelled-membership",
          rideId: ride.id,
          passengerId: shirin.id,
          pickupZone: "BANANI",
          destinationZone: "GULSHAN_1",
          seats: 1,
          farePoisha: 10400,
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      ],
    });

    await transitionRide({
      rideId: ride.id,
      driverId: driver.id,
      nextStatus: "DRIVER_ARRIVED",
    });

    await transitionRide({
      rideId: ride.id,
      driverId: driver.id,
      nextStatus: "STARTED",
    });

    const activeMembership =
      await prisma.ridePassenger.findUniqueOrThrow({
        where: {
          id: "transition-active-membership",
        },
      });

    const cancelledMembership =
      await prisma.ridePassenger.findUniqueOrThrow({
        where: {
          id: "transition-cancelled-membership",
        },
      });

    const updatedVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: {
        id: vehicle.id,
      },
    });

    expect(activeMembership.status).toBe("STARTED");
    expect(cancelledMembership.status).toBe("CANCELLED");
    expect(cancelledMembership.cancelledAt).not.toBeNull();
    expect(updatedVehicle.status).toBe("ON_RIDE");
  });

  it("rejects starting a ride without an assigned vehicle and rolls back the transition", async () => {
    const driver = await createDriver(
      "transition-no-vehicle-driver",
      "transition-no-vehicle@example.com",
    );

    const passenger = await prisma.user.create({
      data: {
        id: "transition-no-vehicle-passenger",
        name: "Nusrat",
        email: "transition-no-vehicle-passenger@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        id: "transition-no-vehicle-ride",
        driverId: driver.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "DRIVER_ARRIVED",
      },
    });

    await prisma.ridePassenger.create({
      data: {
        id: "transition-no-vehicle-membership",
        rideId: ride.id,
        passengerId: passenger.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        seats: 1,
        farePoisha: 8800,
        status: "DRIVER_ARRIVED",
      },
    });

    await expect(
      transitionRide({
        rideId: ride.id,
        driverId: driver.id,
        nextStatus: "STARTED",
      }),
    ).rejects.toThrow("Ride does not have an assigned vehicle");

    const unchangedRide = await prisma.ride.findUniqueOrThrow({
      where: {
        id: ride.id,
      },
    });

    const unchangedPassenger =
      await prisma.ridePassenger.findUniqueOrThrow({
        where: {
          id: "transition-no-vehicle-membership",
        },
      });

    expect(unchangedRide.status).toBe("DRIVER_ARRIVED");
    expect(unchangedRide.startedAt).toBeNull();
    expect(unchangedPassenger.status).toBe("DRIVER_ARRIVED");
  });

  it("rejects a passenger attempting to transition a ride", async () => {
    const passenger = await prisma.user.create({
      data: {
        id: "transition-unauthorized-passenger",
        name: "Nusrat",
        email: "transition-unauthorized@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        id: "transition-passenger-ride",
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "MATCHED",
      },
    });

    await expect(
      transitionRide({
        rideId: ride.id,
        driverId: passenger.id,
        nextStatus: "ACCEPTED",
      }),
    ).rejects.toThrow("Only drivers can transition rides");
  });

  it("rejects a driver who is not assigned to the ride", async () => {
    const assignedDriver = await createDriver(
      "transition-assigned-driver",
      "transition-assigned@example.com",
    );

    const otherDriver = await createDriver(
      "transition-other-driver",
      "transition-other@example.com",
    );

    const ride = await prisma.ride.create({
      data: {
        id: "transition-other-driver-ride",
        driverId: assignedDriver.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "MATCHED",
      },
    });

    await expect(
      transitionRide({
        rideId: ride.id,
        driverId: otherDriver.id,
        nextStatus: "ACCEPTED",
      }),
    ).rejects.toThrow(
      "Driver is not assigned to this ride",
    );
  });

  it("rejects an unknown driver", async () => {
    await expect(
      transitionRide({
        rideId: "any-ride",
        driverId: "driver-does-not-exist",
        nextStatus: "ACCEPTED",
      }),
    ).rejects.toThrow("Driver not found");
  });

  it("rejects transitions for an unknown ride", async () => {
    const driver = await createDriver(
      "transition-missing-ride-driver",
      "transition-missing-ride@example.com",
    );

    await expect(
      transitionRide({
        rideId: "ride-does-not-exist",
        driverId: driver.id,
        nextStatus: "ACCEPTED",
      }),
    ).rejects.toThrow("Ride not found");
  });
});
