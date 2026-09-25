import { describe, expect, it } from "vitest";

import {
  hashPassword,
  verifyPassword,
} from "./password.js";

describe("password", () => {
  it("hashes a password without storing the plaintext value", async () => {
    const password = "DhakaTeslaPool123!";

    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash.length).toBeGreaterThan(20);
  });

  it("verifies the correct password", async () => {
    const password = "DhakaTeslaPool123!";
    const passwordHash = await hashPassword(password);

    await expect(
      verifyPassword(password, passwordHash),
    ).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const passwordHash = await hashPassword(
      "DhakaTeslaPool123!",
    );

    await expect(
      verifyPassword("WrongPassword123!", passwordHash),
    ).resolves.toBe(false);
  });

  it("uses a unique salt for identical passwords", async () => {
    const password = "DhakaTeslaPool123!";

    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).not.toBe(secondHash);

    await expect(
      verifyPassword(password, firstHash),
    ).resolves.toBe(true);

    await expect(
      verifyPassword(password, secondHash),
    ).resolves.toBe(true);
  });
});
