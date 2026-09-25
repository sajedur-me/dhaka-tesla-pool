import Fastify, { type FastifyInstance } from "fastify";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "dhaka-tesla-pool-api",
    };
  });

  return app;
}
