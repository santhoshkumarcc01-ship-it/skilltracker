import { defineConfig } from "vitest/config";
import path from "node:path";
import { loadEnv } from "vite";

const testEnvironment = loadEnv(process.env.NODE_ENV ?? "test", process.cwd(), "");
for (const [key, value] of Object.entries(testEnvironment)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

// Tests must never write through a developer's or production's Supabase URL.
const localTestDatabaseUrl = "postgresql://habithop:habithop@localhost:5432/habithop?schema=public&connect_timeout=2";
function assertLocalTestDatabase(value: string, name: string): string {
  const host = new URL(value).hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"].includes(host)) {
    throw new Error(`${name} must point to a local, disposable PostgreSQL database; refusing to run tests against a remote database.`);
  }
  return value;
}
const isolatedDatabaseUrl = assertLocalTestDatabase(process.env.TEST_DATABASE_URL ?? localTestDatabaseUrl, "TEST_DATABASE_URL");
process.env.DATABASE_URL = isolatedDatabaseUrl;
process.env.DIRECT_URL = assertLocalTestDatabase(process.env.TEST_DIRECT_URL ?? isolatedDatabaseUrl, "TEST_DIRECT_URL");

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
