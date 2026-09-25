import Fastify from "fastify";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import { registerAuthPlugin } from "../plugins/auth.js";
import { requireRole } from "./require-role.js";

describe("requireRole", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  async function createTestApp() {
    process.env.JWT_SECRET = "test-jwt-secret";

    const app = Fastify();
    apps.push(app);

    await registerAuthPlugin(app);

    app.get(
      "/passenger-only",
      {
        preHandler: [
          app.authenticate,
          requireRole("PASSENGER"),
        ],
      },
      async () => {
        return {
          status: "passenger access granted",
        };
      },
    );

    app.get(
      "/driver-only",
      {
        preHandler: [
          app.authenticate,
          requireRole("DRIVER"),
        ],
      },
      async () => {
        return {
          status: "driver access granted",
        };
      },
    );

    return app;
  }

  it("allows a passenger to access a passenger-only route", async () => {
    const app = await createTestApp();

    const token = app.jwt.sign({
      sub: "passenger-1",
      role: "PASSENGER",
    });

    const response = await app.inject({
      method: "GET",
      url: "/passenger-only",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "passenger access granted",
    });
  });

  it("rejects a driver from a passenger-only route", async () => {
    const app = await createTestApp();

    const token = app.jwt.sign({
      sub: "driver-1",
      role: "DRIVER",
    });

    const response = await app.inject({
      method: "GET",
      url: "/passenger-only",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "Forbidden",
    });
  });

  it("allows a driver to access a driver-only route", async () => {
    const app = await createTestApp();

    const token = app.jwt.sign({
      sub: "driver-1",
      role: "DRIVER",
    });

    const response = await app.inject({
      method: "GET",
      url: "/driver-only",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "driver access granted",
    });
  });

  it("rejects a passenger from a driver-only route", async () => {
    const app = await createTestApp();

    const token = app.jwt.sign({
      sub: "passenger-1",
      role: "PASSENGER",
    });

    const response = await app.inject({
      method: "GET",
      url: "/driver-only",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "Forbidden",
    });
  });

  it("rejects an unauthenticated request before role authorization", async () => {
    const app = await createTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/passenger-only",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
    });
  });
});
