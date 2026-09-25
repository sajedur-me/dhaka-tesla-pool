import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireRole } from "../auth/require-role.js";
import { acceptRideRequest } from "../services/accept-ride-request.js";
import {
  DriverMustBeOnlineError,
  DriverVehicleNotFoundError,
  RideCapacityExceededError,
  RideRequestNotFoundError,
  RideRequestUnavailableError,
  VehicleBusyError,
} from "../services/driver-errors.js";
import { getDriverRideRequests } from "../services/get-driver-ride-requests.js";
import { getDriverVehicle } from "../services/get-driver-vehicle.js";
import { updateDriverVehicleStatus } from "../services/update-driver-vehicle-status.js";

const updateVehicleStatusSchema = z.object({
  status: z.enum(["ONLINE", "OFFLINE"]),
});

const rideParamsSchema = z.object({
  rideId: z.string().uuid(),
});

export async function registerDriverRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    "/driver/vehicle",
    {
      preHandler: [
        app.authenticate,
        requireRole("DRIVER"),
      ],
    },
    async (request, reply) => {
      const vehicle = await getDriverVehicle({
        driverId: request.user.sub,
      });

      if (!vehicle) {
        return reply.code(404).send({
          error: "Driver vehicle not found",
        });
      }

      return reply.code(200).send({
        vehicle,
      });
    },
  );

  app.patch(
    "/driver/vehicle/status",
    {
      preHandler: [
        app.authenticate,
        requireRole("DRIVER"),
      ],
    },
    async (request, reply) => {
      const parsed = updateVehicleStatusSchema.safeParse(
        request.body,
      );

      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      try {
        const vehicle =
          await updateDriverVehicleStatus({
            driverId: request.user.sub,
            status: parsed.data.status,
          });

        return reply.code(200).send({
          vehicle,
        });
      } catch (error) {
        if (
          error instanceof DriverVehicleNotFoundError
        ) {
          return reply.code(404).send({
            error: error.message,
          });
        }

        if (error instanceof VehicleBusyError) {
          return reply.code(409).send({
            error: error.message,
          });
        }

        throw error;
      }
    },
  );

  app.get(
    "/driver/requests",
    {
      preHandler: [
        app.authenticate,
        requireRole("DRIVER"),
      ],
    },
    async (request, reply) => {
      try {
        const requests = await getDriverRideRequests({
          driverId: request.user.sub,
        });

        return reply.code(200).send({
          requests,
        });
      } catch (error) {
        if (
          error instanceof DriverVehicleNotFoundError
        ) {
          return reply.code(404).send({
            error: error.message,
          });
        }

        if (
          error instanceof DriverMustBeOnlineError
        ) {
          return reply.code(409).send({
            error: error.message,
          });
        }

        throw error;
      }
    },
  );

  app.post(
    "/driver/requests/:rideId/accept",
    {
      preHandler: [
        app.authenticate,
        requireRole("DRIVER"),
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

      try {
        const ride = await acceptRideRequest({
          driverId: request.user.sub,
          rideId: parsed.data.rideId,
        });

        return reply.code(200).send({
          ride,
        });
      } catch (error) {
        if (
          error instanceof RideRequestNotFoundError
        ) {
          return reply.code(404).send({
            error: error.message,
          });
        }

        if (
          error instanceof DriverVehicleNotFoundError
        ) {
          return reply.code(404).send({
            error: error.message,
          });
        }

        if (
          error instanceof DriverMustBeOnlineError ||
          error instanceof RideRequestUnavailableError ||
          error instanceof RideCapacityExceededError
        ) {
          return reply.code(409).send({
            error: error.message,
          });
        }

        throw error;
      }
    },
  );
}
