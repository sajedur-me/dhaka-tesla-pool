import { describe, expect, it } from "vitest";

import {
  loginSchema,
  registerSchema,
} from "./auth.schemas.js";

describe("registerSchema", () => {
  it("accepts a valid passenger registration", () => {
    const result = registerSchema.safeParse({
      name: "Nusrat",
      email: "nusrat@example.com",
      password: "SecurePass123!",
      role: "PASSENGER",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid driver registration", () => {
    const result = registerSchema.safeParse({
      name: "Jashim",
      email: "jashim@example.com",
      password: "SecurePass123!",
      role: "DRIVER",
    });

    expect(result.success).toBe(true);
  });

  it("normalizes the name and email", () => {
    const result = registerSchema.parse({
      name: "  Nusrat  ",
      email: "  NUSRAT@EXAMPLE.COM  ",
      password: "SecurePass123!",
      role: "PASSENGER",
    });

    expect(result.name).toBe("Nusrat");
    expect(result.email).toBe("nusrat@example.com");
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({
      name: "Nusrat",
      email: "not-an-email",
      password: "SecurePass123!",
      role: "PASSENGER",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    const result = registerSchema.safeParse({
      name: "Nusrat",
      email: "nusrat@example.com",
      password: "short",
      role: "PASSENGER",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unsupported role", () => {
    const result = registerSchema.safeParse({
      name: "Nusrat",
      email: "nusrat@example.com",
      password: "SecurePass123!",
      role: "ADMIN",
    });

    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid login credentials and normalizes the email", () => {
    const result = loginSchema.parse({
      email: "  NUSRAT@EXAMPLE.COM  ",
      password: "SecurePass123!",
    });

    expect(result.email).toBe("nusrat@example.com");
    expect(result.password).toBe("SecurePass123!");
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "invalid-email",
      password: "SecurePass123!",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "nusrat@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});
