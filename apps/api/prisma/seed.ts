import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { hashPassword } from "../src/auth/password.js";
import { PrismaClient } from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const STORY_PASSWORD = "DhakaPool123!";

async function main(): Promise<void> {
  const passwordHash = await hashPassword(
    STORY_PASSWORD,
  );

  const jashim = await prisma.user.upsert({
    where: {
      email: "jashim@dhakapool.local",
    },
    update: {
      name: "Jashim",
      passwordHash,
      role: "DRIVER",
    },
    create: {
      name: "Jashim",
      email: "jashim@dhakapool.local",
      passwordHash,
      role: "DRIVER",
    },
  });

  const nusrat = await prisma.user.upsert({
    where: {
      email: "nusrat@dhakapool.local",
    },
    update: {
      name: "Nusrat",
      passwordHash,
      role: "PASSENGER",
    },
    create: {
      name: "Nusrat",
      email: "nusrat@dhakapool.local",
      passwordHash,
      role: "PASSENGER",
    },
  });

  const rafiq = await prisma.user.upsert({
    where: {
      email: "rafiq@dhakapool.local",
    },
    update: {
      name: "Rafiq",
      passwordHash,
      role: "PASSENGER",
    },
    create: {
      name: "Rafiq",
      email: "rafiq@dhakapool.local",
      passwordHash,
      role: "PASSENGER",
    },
  });

  const shirin = await prisma.user.upsert({
    where: {
      email: "shirin@dhakapool.local",
    },
    update: {
      name: "Shirin",
      passwordHash,
      role: "PASSENGER",
    },
    create: {
      name: "Shirin",
      email: "shirin@dhakapool.local",
      passwordHash,
      role: "PASSENGER",
    },
  });

  const bullet = await prisma.vehicle.upsert({
    where: {
      name: "Bullet",
    },
    update: {
      driverId: jashim.id,
      capacity: 3,
      status: "OFFLINE",
    },
    create: {
      name: "Bullet",
      driverId: jashim.id,
      capacity: 3,
      status: "OFFLINE",
    },
  });

  console.log("Dhaka Tesla Pool story seed complete.");
  console.log("");
  console.log("Demo accounts:");
  console.log(
    "  Jashim: jashim@dhakapool.local",
  );
  console.log(
    "  Nusrat: nusrat@dhakapool.local",
  );
  console.log(
    "  Rafiq:  rafiq@dhakapool.local",
  );
  console.log(
    "  Shirin: shirin@dhakapool.local",
  );
  console.log(
    `  Password: ${STORY_PASSWORD}`,
  );
  console.log("");
  console.log(
    `Bullet: ${bullet.capacity} seats, ${bullet.status}`,
  );
  console.log("");
  console.log(
    `Seeded users: ${[
      jashim,
      nusrat,
      rafiq,
      shirin,
    ]
      .map((user) => user.name)
      .join(", ")}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Story seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
