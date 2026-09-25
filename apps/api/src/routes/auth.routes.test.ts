import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { buildApp } from "../app.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { verifyPassword } from "../auth/password.js";
import { prisma } from "../db/prisma.js";

describe("auth routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    app = await buildApp();
  });

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

    await app.close();
    await prisma.$disconnect();
  });

  it("registers a passenger and returns a valid JWT", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Nusrat",
        email: "nusrat-http@example.com",
        password: "SecurePass123!",
        role: "PASSENGER",
      },
    });

    expect(response.statusCode).toBe(201);

    const body = response.json();

    expect(body.user).toMatchObject({
      name: "Nusrat",
      email: "nusrat-http@example.com",
      role: "PASSENGER",
    });

    expect(body.user).not.toHaveProperty("passwordHash");
    expect(body.token).toEqual(expect.any(String));

    const decoded = app.jwt.verify<AuthenticatedUser>(
      body.token,
    );

    expect(decoded.sub).toBe(body.user.id);
    expect(decoded.role).toBe("PASSENGER");

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: body.user.id,
      },
    });

    expect(storedUser.passwordHash).not.toBe(
      "SecurePass123!",
    );

    await expect(
      verifyPassword(
        "SecurePass123!",
        storedUser.passwordHash,
      ),
    ).resolves.toBe(true);
  });

  it("normalizes registration input", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "  Nusrat  ",
        email: "  NUSRAT.NORMALIZED@EXAMPLE.COM  ",
        password: "SecurePass123!",
        role: "PASSENGER",
      },
    });

    expect(response.statusCode).toBe(201);

    expect(response.json().user).toMatchObject({
      name: "Nusrat",
      email: "nusrat.normalized@example.com",
    });
  });

  it("rejects invalid registration input", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "N",
        email: "invalid-email",
        password: "short",
        role: "ADMIN",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe(
      "Invalid request",
    );
  });

  it("rejects a duplicate email", async () => {
    const payload = {
      name: "Nusrat",
      email: "duplicate-http@example.com",
      password: "SecurePass123!",
      role: "PASSENGER",
    };

    const firstResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload,
    });

    const secondResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload,
    });

    expect(firstResponse.statusCode).toBe(201);
    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.json()).toEqual({
      error: "Email is already registered",
    });
  });

  it("logs in with valid credentials and returns a valid JWT", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Rafiq",
        email: "rafiq-http@example.com",
        password: "SecurePass123!",
        role: "PASSENGER",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "RAFIQ-HTTP@EXAMPLE.COM",
        password: "SecurePass123!",
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json();

    expect(body.user).toMatchObject({
      name: "Rafiq",
      email: "rafiq-http@example.com",
      role: "PASSENGER",
    });

    expect(body.user).not.toHaveProperty("passwordHash");
    expect(body.token).toEqual(expect.any(String));

    const decoded = app.jwt.verify<AuthenticatedUser>(
      body.token,
    );

    expect(decoded.sub).toBe(body.user.id);
    expect(decoded.role).toBe("PASSENGER");
  });

  it("rejects login with an incorrect password", async () => {
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Shirin",
        email: "shirin-http@example.com",
        password: "SecurePass123!",
        role: "PASSENGER",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "shirin-http@example.com",
        password: "WrongPassword123!",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Invalid email or password",
    });
  });

  it("rejects login for an unknown email without revealing account existence", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "unknown-http@example.com",
        password: "SecurePass123!",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Invalid email or password",
    });
  });

  it("rejects invalid login input", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "not-an-email",
        password: "",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe(
      "Invalid request",
    );
  });
});
