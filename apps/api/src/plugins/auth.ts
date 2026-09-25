import fastifyJwt from "@fastify/jwt";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";

import "../auth/auth.types.js";

export async function registerAuthPlugin(
  app: FastifyInstance,
): Promise<void> {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not set");
  }

  await app.register(fastifyJwt, {
    secret: jwtSecret,
    sign: {
      expiresIn: "1h",
    },
  });

  app.decorate(
    "authenticate",
    async function authenticate(
      request: FastifyRequest,
      reply: FastifyReply,
    ) {
      try {
        await request.jwtVerify();
      } catch {
        await reply.code(401).send({
          error: "Unauthorized",
        });
      }
    },
  );
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}
