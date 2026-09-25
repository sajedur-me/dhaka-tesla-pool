import type { FastifyInstance } from "fastify";

import {
  authenticateUser,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  registerUser,
} from "../auth/auth.service.js";
import {
  loginSchema,
  registerSchema,
} from "../auth/auth.schemas.js";

export async function registerAuthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
    }

    try {
      const user = await registerUser(parsed.data);

      const token = app.jwt.sign({
        sub: user.id,
        role: user.role,
      });

      return reply.code(201).send({
        user,
        token,
      });
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        return reply.code(409).send({
          error: "Email is already registered",
        });
      }

      throw error;
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
    }

    try {
      const user = await authenticateUser(parsed.data);

      const token = app.jwt.sign({
        sub: user.id,
        role: user.role,
      });

      return reply.code(200).send({
        user,
        token,
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return reply.code(401).send({
          error: "Invalid email or password",
        });
      }

      throw error;
    }
  });
}
