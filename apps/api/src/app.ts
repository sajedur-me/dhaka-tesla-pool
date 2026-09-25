import Fastify, {
  type FastifyInstance,
} from "fastify";

import { registerAuthPlugin } from "./plugins/auth.js";
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { registerPassengerRoutes } from "./routes/passenger.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  await registerAuthPlugin(app);

  await registerAuthRoutes(app);
  await registerPassengerRoutes(app);

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "dhaka-tesla-pool-api",
    };
  });

  return app;
}
