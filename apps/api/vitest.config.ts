import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/dhaka_tesla_pool_test?schema=public";

export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NODE_ENV: "test",
    },
  },
});
