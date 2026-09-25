import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const originalWebOrigin = process.env.WEB_ORIGIN;
const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalWebOrigin === undefined) {
    delete process.env.WEB_ORIGIN;
  } else {
    process.env.WEB_ORIGIN = originalWebOrigin;
  }

  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }
});

describe("application CORS", () => {
  it("allows the configured web origin", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.WEB_ORIGIN = "http://localhost:3000";

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/auth/login",
        headers: {
          origin: "http://localhost:3000",
          "access-control-request-method": "POST",
        },
      });

      expect(response.statusCode).toBe(204);
      expect(
        response.headers["access-control-allow-origin"],
      ).toBe("http://localhost:3000");
    } finally {
      await app.close();
    }
  });

  it("does not allow an unexpected origin", async () => {
    process.env.JWT_SECRET = "test-jwt-secret";
    process.env.WEB_ORIGIN = "http://localhost:3000";

    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/auth/login",
        headers: {
          origin: "https://unexpected.example.com",
          "access-control-request-method": "POST",
        },
      });

      expect(
        response.headers["access-control-allow-origin"],
      ).not.toBe("https://unexpected.example.com");
    } finally {
      await app.close();
    }
  });
});
