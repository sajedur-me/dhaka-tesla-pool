import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "../db/prisma.js";
import {
  authenticateUser,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  registerUser,
} from "./auth.service.js";
import { verifyPassword } from "./password.js";

describe("auth service", () => {
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

  it("registers a passenger with a hashed password", async () => {
    const user = await registerUser({
      name: "Nusrat",
      email: "nusrat-auth@example.com",
      password: "SecurePass123!",
      role: "PASSENGER",
    });

    expect(user.name).toBe("Nusrat");
    expect(user.email).toBe("nusrat-auth@example.com");
    expect(user.role).toBe("PASSENGER");
    expect(user).not.toHaveProperty("passwordHash");

    const storedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
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

  it("registers a driver", async () => {
    const user = await registerUser({
      name: "Jashim",
      email: "jashim-auth@example.com",
      password: "SecurePass123!",
      role: "DRIVER",
    });

    expect(user.role).toBe("DRIVER");
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("rejects a duplicate email", async () => {
    await registerUser({
      name: "Nusrat",
      email: "duplicate@example.com",
      password: "SecurePass123!",
      role: "PASSENGER",
    });

    await expect(
      registerUser({
        name: "Another Nusrat",
        email: "duplicate@example.com",
        password: "AnotherPass123!",
        role: "PASSENGER",
      }),
    ).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
  });

  it("authenticates a user with valid credentials", async () => {
    const registeredUser = await registerUser({
      name: "Nusrat",
      email: "login@example.com",
      password: "SecurePass123!",
      role: "PASSENGER",
    });

    const authenticatedUser = await authenticateUser({
      email: "login@example.com",
      password: "SecurePass123!",
    });

    expect(authenticatedUser).toEqual(registeredUser);
    expect(authenticatedUser).not.toHaveProperty(
      "passwordHash",
    );
  });

  it("rejects an incorrect password", async () => {
    await registerUser({
      name: "Nusrat",
      email: "wrong-password@example.com",
      password: "SecurePass123!",
      role: "PASSENGER",
    });

    await expect(
      authenticateUser({
        email: "wrong-password@example.com",
        password: "WrongPassword123!",
      }),
    ).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it("rejects an unknown email with the same credential error", async () => {
    await expect(
      authenticateUser({
        email: "unknown@example.com",
        password: "SecurePass123!",
      }),
    ).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });
});
