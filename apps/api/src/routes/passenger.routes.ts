import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireRole } from "../auth/require-role.js";
import { POOLING_ZONES } from "../domain/pooling/dhaka-corridors.js";
import { cancelRideRequest } from "../services/cancel-ride-request.js";
import { createRideRequest } from "../services/create-ride-request.js";
import { getPassengerRide } from "../services/get-passenger-ride.js";
import { getPassengerRides } from "../services/get-passenger-rides.js";

const dhakaZoneSchema = z.enum(POOLING_ZONES);

const createPassengerRideSchema = z.object({
  pickupZone: dhakaZoneSchema,
  destinationZone: dhakaZoneSchema,
  seats: z
    .number()
    .int()
    .positive()
    .max(3),
});

const rideParamsSchema = z.object({
  rideId: z.string().uuid(),
});

export async function registerPassengerRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/passenger/rides",
    {
      preHandler: [
        app.authenticate,
        requireRole("PASSENGER"),
      ],
    },
    async (request, reply) => {
      const parsed = createPassengerRideSchema.safeParse(
        request.body,
      );

      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      try {
        const rideRequest = await createRideRequest({
          passengerId: request.user.sub,
          pickupZone: parsed.data.pickupZone,
          destinationZone: parsed.data.destinationZone,
          seats: parsed.data.seats,
        });

        return reply.code(201).send({
          ride: rideRequest,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.code(400).send({
            error: error.message,
          });
        }

        throw error;
      }
    },
  );

  app.get(
    "/passenger/rides",
    {
      preHandler: [
        app.authenticate,
        requireRole("PASSENGER"),
      ],
    },
    async (request, reply) => {
      const rides = await getPassengerRides({
        passengerId: request.user.sub,
      });

      return reply.code(200).send({
        rides,
      });
    },
  );

  app.get(
    "/passenger/rides/:rideId",
    {
      preHandler: [
        app.authenticate,
        requireRole("PASSENGER"),
      ],
    },
    async (request, reply) => {
      const parsed = rideParamsSchema.safeParse(
        request.params,
      );

      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid ride ID",
        });
      }

      const ride = await getPassengerRide({
        passengerId: request.user.sub,
        rideId: parsed.data.rideId,
      });

      if (!ride) {
        return reply.code(404).send({
          error: "Ride not found",
        });
      }

      return reply.code(200).send({
        ride,
      });
    },
  );

  app.post(
    "/passenger/rides/:rideId/cancel",
    {
      preHandler: [
        app.authenticate,
        requireRole("PASSENGER"),
      ],
    },
    async (request, reply) => {
      const parsed = rideParamsSchema.safeParse(
        request.params,
      );

      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid ride ID",
        });
      }

      const ride = await getPassengerRide({
        passengerId: request.user.sub,
        rideId: parsed.data.rideId,
      });

      if (!ride) {
        return reply.code(404).send({
          error: "Ride not found",
        });
      }

      try {
        const cancelledRide = await cancelRideRequest({
          passengerId: request.user.sub,
          rideId: parsed.data.rideId,
        });

        return reply.code(200).send({
          ride: cancelledRide,
        });
      } catch (error) {
        if (error instanceof Error) {
          return reply.code(400).send({
            error: error.message,
          });
        }

        throw error;
      }
    },
  );
}
