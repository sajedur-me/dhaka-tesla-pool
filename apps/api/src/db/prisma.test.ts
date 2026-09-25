import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "./prisma.js";

describe("Prisma database connection", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects to PostgreSQL", async () => {
    const result = await prisma.$queryRaw<
      Array<{ current_database: string }>
    >`SELECT current_database()`;

    expect(result[0]?.current_database).toBe("dhaka_tesla_pool");
  });
});
