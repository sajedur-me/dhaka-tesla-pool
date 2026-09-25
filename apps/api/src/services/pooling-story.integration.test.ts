import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "../db/prisma.js";
import { acceptRideRequest } from "./accept-ride-request.js";
import { createRideRequest } from "./create-ride-request.js";
import { matchRideRequest } from "./match-ride-request.js";
import { updateDriverVehicleStatus } from "./update-driver-vehicle-status.js";

describe("Dhaka Tesla Pool story integration", () => {
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

  it("pools Nusrat and Rafiq into Jashim's accepted Bullet ride", async () => {
    const jashim = await prisma.user.create({
      data: {
        id: "story-jashim",
        name: "Jashim",
        email: "story-jashim@example.com",
        passwordHash: "test-hash",
        role: "DRIVER",
      },
    });

    const nusrat = await prisma.user.create({
      data: {
        id: "story-nusrat",
        name: "Nusrat",
        email: "story-nusrat@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const rafiq = await prisma.user.create({
      data: {
        id: "story-rafiq",
        name: "Rafiq",
        email: "story-rafiq@example.com",
        passwordHash: "test-hash",
        role: "PASSENGER",
      },
    });

    const bullet = await prisma.vehicle.create({
      data: {
        id: "story-bullet",
        name: "Bullet",
        capacity: 3,
        status: "OFFLINE",
        driverId: jashim.id,
      },
    });

    const onlineBullet =
      await updateDriverVehicleStatus({
        driverId: jashim.id,
        status: "ONLINE",
      });

    expect(onlineBullet.id).toBe(bullet.id);
    expect(onlineBullet.status).toBe("ONLINE");
    expect(onlineBullet.capacity).toBe(3);

    const nusratRequest = await createRideRequest({
      passengerId: nusrat.id,
      pickupZone: "BANANI",
      destinationZone: "MOHAKHALI",
      seats: 1,
    });

    expect(nusratRequest.ride.status).toBe(
      "REQUESTED",
    );
    expect(
      nusratRequest.membership.farePoisha,
    ).toBe(8800);
    expect(
      nusratRequest.membership.status,
    ).toBe("REQUESTED");

    const acceptedRide = await acceptRideRequest({
      driverId: jashim.id,
      rideId: nusratRequest.ride.id,
    });

    expect(acceptedRide.id).toBe(
      nusratRequest.ride.id,
    );
    expect(acceptedRide.driverId).toBe(jashim.id);
    expect(acceptedRide.vehicleId).toBe(bullet.id);
    expect(acceptedRide.status).toBe("ACCEPTED");
    expect(acceptedRide.passengers).toHaveLength(
      1,
    );
    expect(
      acceptedRide.passengers[0]?.passengerId,
    ).toBe(nusrat.id);
    expect(
      acceptedRide.passengers[0]?.status,
    ).toBe("ACCEPTED");

    const rafiqRequest = await createRideRequest({
      passengerId: rafiq.id,
      pickupZone: "BANANI",
      destinationZone: "GULSHAN_1",
      seats: 1,
    });

    expect(rafiqRequest.ride.status).toBe(
      "REQUESTED",
    );
    expect(
      rafiqRequest.membership.farePoisha,
    ).toBe(10400);

    const matchedRafiq = await matchRideRequest({
      requestRideId: rafiqRequest.ride.id,
    });

    expect(matchedRafiq).not.toBeNull();
    expect(matchedRafiq?.rideId).toBe(
      acceptedRide.id,
    );
    expect(
      matchedRafiq?.membership.passengerId,
    ).toBe(rafiq.id);
    expect(
      matchedRafiq?.membership.status,
    ).toBe("ACCEPTED");
    expect(
      matchedRafiq?.membership.farePoisha,
    ).toBe(10400);

    const finalRide =
      await prisma.ride.findUniqueOrThrow({
        where: {
          id: acceptedRide.id,
        },
        include: {
          passengers: {
            orderBy: {
              passengerId: "asc",
            },
          },
          vehicle: true,
        },
      });

    expect(finalRide.status).toBe("ACCEPTED");
    expect(finalRide.driverId).toBe(jashim.id);
    expect(finalRide.vehicleId).toBe(bullet.id);
    expect(finalRide.vehicle?.status).toBe(
      "ONLINE",
    );
    expect(finalRide.vehicle?.capacity).toBe(3);
    expect(finalRide.passengers).toHaveLength(2);

    const nusratMembership =
      finalRide.passengers.find(
        (passenger) =>
          passenger.passengerId === nusrat.id,
      );

    const rafiqMembership =
      finalRide.passengers.find(
        (passenger) =>
          passenger.passengerId === rafiq.id,
      );

    expect(nusratMembership).toBeDefined();
    expect(nusratMembership?.pickupZone).toBe(
      "BANANI",
    );
    expect(
      nusratMembership?.destinationZone,
    ).toBe("MOHAKHALI");
    expect(nusratMembership?.seats).toBe(1);
    expect(nusratMembership?.farePoisha).toBe(
      8800,
    );
    expect(nusratMembership?.status).toBe(
      "ACCEPTED",
    );

    expect(rafiqMembership).toBeDefined();
    expect(rafiqMembership?.pickupZone).toBe(
      "BANANI",
    );
    expect(
      rafiqMembership?.destinationZone,
    ).toBe("GULSHAN_1");
    expect(rafiqMembership?.seats).toBe(1);
    expect(rafiqMembership?.farePoisha).toBe(
      10400,
    );
    expect(rafiqMembership?.status).toBe(
      "ACCEPTED",
    );

    const occupiedSeats =
      finalRide.passengers.reduce(
        (total, passenger) =>
          total + passenger.seats,
        0,
      );

    expect(occupiedSeats).toBe(2);
    expect(occupiedSeats).toBeLessThanOrEqual(
      bullet.capacity,
    );

    const rafiqOriginalRide =
      await prisma.ride.findUnique({
        where: {
          id: rafiqRequest.ride.id,
        },
      });

    expect(rafiqOriginalRide).toBeNull();
  });
});
