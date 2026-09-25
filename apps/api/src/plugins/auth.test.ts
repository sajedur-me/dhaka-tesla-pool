import Fastify from "fastify";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import { registerAuthPlugin } from "./auth.js";

describe("auth plugin", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it("rejects configuration without JWT_SECRET", async () => {
    delete process.env.JWT_SECRET;

    const app = Fastify();

    await expect(
      registerAuthPlugin(app),
    ).rejects.toThrow("JWT_SECRET is not set");

    await app.close();
  });

  it("authenticates a valid JWT and exposes its claims", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";

    const app = Fastify();

    await registerAuthPlugin(app);

    app.get(
      "/protected",
      {
        preHandler: app.authenticate,
      },
      async (request) => {
        return {
          userId: request.user.sub,
          role: request.user.role,
        };
      },
    );

    const token = app.jwt.sign({
      sub: "passenger-123",
      role: "PASSENGER",
    });

    const response = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: "passenger-123",
      role: "PASSENGER",
    });

    await app.close();
  });

  it("rejects a protected request without a JWT", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";

    const app = Fastify();

    await registerAuthPlugin(app);

    app.get(
      "/protected",
      {
        preHandler: app.authenticate,
      },
      async () => ({
        status: "ok",
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/protected",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
    });

    await app.close();
  });

  it("rejects an invalid JWT", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";

    const app = Fastify();

    await registerAuthPlugin(app);

    app.get(
      "/protected",
      {
        preHandler: app.authenticate,
      },
      async () => ({
        status: "ok",
      }),
    );

    const response = await app.inject({
      method: "GET",
      url: "/protected",
      headers: {
        authorization: "Bearer invalid-token",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
    });

    await app.close();
  });
});
