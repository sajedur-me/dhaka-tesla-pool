import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

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

  it("moves an assigned pooled ride and its active passengers through the lifecycle while synchronizing the vehicle", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "hashed-password",
        role: "DRIVER",
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        name: "Bullet",
        capacity: 3,
        status: "ONLINE",
        driverId: driver.id,
      },
    });

    const nusrat = await prisma.user.create({
      data: {
        name: "Nusrat",
        email: "nusrat@example.com",
        passwordHash: "hashed-password",
        role: "PASSENGER",
      },
    });

    const rafiq = await prisma.user.create({
      data: {
        name: "Rafiq",
        email: "rafiq@example.com",
        passwordHash: "hashed-password",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "MATCHED",
        passengers: {
          create: [
            {
              passengerId: nusrat.id,
              pickupZone: "BANANI",
              destinationZone: "MOHAKHALI",
              seats: 1,
              farePoisha: 8_800,
              status: "MATCHED",
            },
            {
              passengerId: rafiq.id,
              pickupZone: "BANANI",
              destinationZone: "GULSHAN_1",
              seats: 1,
              farePoisha: 10_400,
              status: "MATCHED",
            },
          ],
        },
      },
    });

    await transitionRide({
      rideId: ride.id,
      driverId: driver.id,
      nextStatus: "ACCEPTED",
    });

    let storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedVehicle.status).toBe("ONLINE");

    await transitionRide({
      rideId: ride.id,
      driverId: driver.id,
      nextStatus: "DRIVER_ARRIVED",
    });

    storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedVehicle.status).toBe("ONLINE");

    await transitionRide({
      rideId: ride.id,
      driverId: driver.id,
      nextStatus: "STARTED",
    });

    storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedVehicle.status).toBe("ON_RIDE");

    const startedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    expect(startedRide.status).toBe("STARTED");
    expect(startedRide.startedAt).not.toBeNull();

    await transitionRide({
      rideId: ride.id,
      driverId: driver.id,
      nextStatus: "COMPLETED",
    });

    const completedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    expect(completedRide.status).toBe("COMPLETED");
    expect(completedRide.completedAt).not.toBeNull();

    storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedVehicle.status).toBe("ONLINE");

    const passengers =
      await prisma.ridePassenger.findMany({
        where: {
          rideId: ride.id,
        },
        orderBy: {
          farePoisha: "asc",
        },
      });

    expect(passengers).toHaveLength(2);
    expect(
      passengers.every(
        (passenger) =>
          passenger.status === "COMPLETED",
      ),
    ).toBe(true);
  });

  it("rejects an invalid lifecycle jump", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "hashed-password",
        role: "DRIVER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
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

    const storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    expect(storedRide.status).toBe("MATCHED");
  });

  it("rejects a driver attempting to cancel a ride", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "hashed-password",
        role: "DRIVER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
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

    const storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    expect(storedRide.status).toBe("MATCHED");
  });

  it("does not reactivate a cancelled passenger during ride transitions", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "hashed-password",
        role: "DRIVER",
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        name: "Bullet",
        capacity: 3,
        status: "ONLINE",
        driverId: driver.id,
      },
    });

    const activePassenger =
      await prisma.user.create({
        data: {
          name: "Nusrat",
          email: "nusrat@example.com",
          passwordHash: "hashed-password",
          role: "PASSENGER",
        },
      });

    const cancelledPassenger =
      await prisma.user.create({
        data: {
          name: "Rafiq",
          email: "rafiq@example.com",
          passwordHash: "hashed-password",
          role: "PASSENGER",
        },
      });

    const ride = await prisma.ride.create({
      data: {
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "ACCEPTED",
        passengers: {
          create: [
            {
              passengerId: activePassenger.id,
              pickupZone: "BANANI",
              destinationZone: "MOHAKHALI",
              seats: 1,
              farePoisha: 8_800,
              status: "ACCEPTED",
            },
            {
              passengerId: cancelledPassenger.id,
              pickupZone: "BANANI",
              destinationZone: "GULSHAN_1",
              seats: 1,
              farePoisha: 10_400,
              status: "CANCELLED",
              cancelledAt: new Date(),
            },
          ],
        },
      },
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

    const passengers =
      await prisma.ridePassenger.findMany({
        where: {
          rideId: ride.id,
        },
      });

    const active = passengers.find(
      (passenger) =>
        passenger.passengerId === activePassenger.id,
    );

    const cancelled = passengers.find(
      (passenger) =>
        passenger.passengerId ===
        cancelledPassenger.id,
    );

    expect(active?.status).toBe("STARTED");
    expect(cancelled?.status).toBe("CANCELLED");

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedVehicle.status).toBe("ON_RIDE");
  });

  it("rejects starting a ride without an assigned vehicle and rolls back the transition", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "hashed-password",
        role: "DRIVER",
      },
    });

    const passenger = await prisma.user.create({
      data: {
        name: "Nusrat",
        email: "nusrat@example.com",
        passwordHash: "hashed-password",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        driverId: driver.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "DRIVER_ARRIVED",
        passengers: {
          create: {
            passengerId: passenger.id,
            pickupZone: "BANANI",
            destinationZone: "MOHAKHALI",
            seats: 1,
            farePoisha: 8_800,
            status: "DRIVER_ARRIVED",
          },
        },
      },
    });

    await expect(
      transitionRide({
        rideId: ride.id,
        driverId: driver.id,
        nextStatus: "STARTED",
      }),
    ).rejects.toThrow(
      "Ride does not have an assigned vehicle",
    );

    const storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    const membership =
      await prisma.ridePassenger.findFirstOrThrow({
        where: {
          rideId: ride.id,
          passengerId: passenger.id,
        },
      });

    expect(storedRide.status).toBe(
      "DRIVER_ARRIVED",
    );
    expect(storedRide.startedAt).toBeNull();
    expect(membership.status).toBe(
      "DRIVER_ARRIVED",
    );
  });

  it("rejects starting a ride when the assigned vehicle is offline and rolls back the transition", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "hashed-password",
        role: "DRIVER",
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        name: "Bullet",
        capacity: 3,
        status: "OFFLINE",
        driverId: driver.id,
      },
    });

    const passenger = await prisma.user.create({
      data: {
        name: "Nusrat",
        email: "nusrat@example.com",
        passwordHash: "hashed-password",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "DRIVER_ARRIVED",
        passengers: {
          create: {
            passengerId: passenger.id,
            pickupZone: "BANANI",
            destinationZone: "MOHAKHALI",
            seats: 1,
            farePoisha: 8_800,
            status: "DRIVER_ARRIVED",
          },
        },
      },
    });

    await expect(
      transitionRide({
        rideId: ride.id,
        driverId: driver.id,
        nextStatus: "STARTED",
      }),
    ).rejects.toThrow(
      "Vehicle must be online to start a ride",
    );

    const storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    const storedPassenger =
      await prisma.ridePassenger.findFirstOrThrow({
        where: {
          rideId: ride.id,
          passengerId: passenger.id,
        },
      });

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedRide.status).toBe(
      "DRIVER_ARRIVED",
    );
    expect(storedRide.startedAt).toBeNull();
    expect(storedPassenger.status).toBe(
      "DRIVER_ARRIVED",
    );
    expect(storedVehicle.status).toBe("OFFLINE");
  });

  it("rejects completing a ride when the assigned vehicle is not on a ride and rolls back the transition", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "hashed-password",
        role: "DRIVER",
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        name: "Bullet",
        capacity: 3,
        status: "ONLINE",
        driverId: driver.id,
      },
    });

    const passenger = await prisma.user.create({
      data: {
        name: "Nusrat",
        email: "nusrat@example.com",
        passwordHash: "hashed-password",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
        driverId: driver.id,
        vehicleId: vehicle.id,
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "STARTED",
        startedAt: new Date(),
        passengers: {
          create: {
            passengerId: passenger.id,
            pickupZone: "BANANI",
            destinationZone: "MOHAKHALI",
            seats: 1,
            farePoisha: 8_800,
            status: "STARTED",
          },
        },
      },
    });

    await expect(
      transitionRide({
        rideId: ride.id,
        driverId: driver.id,
        nextStatus: "COMPLETED",
      }),
    ).rejects.toThrow(
      "Vehicle must be on a ride to complete a ride",
    );

    const storedRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: ride.id,
        },
      });

    const storedPassenger =
      await prisma.ridePassenger.findFirstOrThrow({
        where: {
          rideId: ride.id,
          passengerId: passenger.id,
        },
      });

    const storedVehicle =
      await prisma.vehicle.findUniqueOrThrow({
        where: {
          id: vehicle.id,
        },
      });

    expect(storedRide.status).toBe("STARTED");
    expect(storedRide.completedAt).toBeNull();
    expect(storedPassenger.status).toBe(
      "STARTED",
    );
    expect(storedVehicle.status).toBe("ONLINE");
  });

  it("rejects a passenger attempting to transition a ride", async () => {
    const passenger = await prisma.user.create({
      data: {
        name: "Nusrat",
        email: "nusrat@example.com",
        passwordHash: "hashed-password",
        role: "PASSENGER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
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
    ).rejects.toThrow(
      "Only drivers can transition rides",
    );
  });

  it("rejects a driver who is not assigned to the ride", async () => {
    const assignedDriver = await prisma.user.create({
      data: {
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "hashed-password",
        role: "DRIVER",
      },
    });

    const otherDriver = await prisma.user.create({
      data: {
        name: "Other Driver",
        email: "other-driver@example.com",
        passwordHash: "hashed-password",
        role: "DRIVER",
      },
    });

    const ride = await prisma.ride.create({
      data: {
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
    const ride = await prisma.ride.create({
      data: {
        pickupZone: "BANANI",
        destinationZone: "MOHAKHALI",
        status: "MATCHED",
      },
    });

    await expect(
      transitionRide({
        rideId: ride.id,
        driverId:
          "00000000-0000-4000-8000-000000000001",
        nextStatus: "ACCEPTED",
      }),
    ).rejects.toThrow("Driver not found");
  });

  it("rejects transitions for an unknown ride", async () => {
    const driver = await prisma.user.create({
      data: {
        name: "Jashim",
        email: "jashim@example.com",
        passwordHash: "hashed-password",
        role: "DRIVER",
      },
    });

    await expect(
      transitionRide({
        rideId:
          "00000000-0000-4000-8000-000000000002",
        driverId: driver.id,
        nextStatus: "ACCEPTED",
      }),
    ).rejects.toThrow("Ride not found");
  });
});
