import { defineConfig, devices } from "@playwright/test";

const e2ePort = 3100;
const defaultTestDatabaseUrl = "postgresql://habithop:habithop@localhost:5432/habithop?schema=public&connect_timeout=2";
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? defaultTestDatabaseUrl;
const testDirectUrl = process.env.TEST_DIRECT_URL ?? testDatabaseUrl;
for (const [name, value] of [["DATABASE_URL", testDatabaseUrl], ["DIRECT_URL", testDirectUrl]] as const) {
  const host = new URL(value).hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"].includes(host)) {
    throw new Error(`Playwright ${name} must use a local, disposable PostgreSQL database; refusing to run E2E against a remote database.`);
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: `http://localhost:${e2ePort}`, trace: "on-first-retry", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm run dev",
    url: `http://localhost:${e2ePort}`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      PORT: String(e2ePort),
      DATABASE_URL: testDatabaseUrl,
      DIRECT_URL: testDirectUrl,
      JWT_SECRET: process.env.TEST_JWT_SECRET ?? "habithop-e2e-test-secret-not-for-production",
      CRON_SECRET: process.env.TEST_CRON_SECRET ?? "habithop-e2e-cron-secret-not-for-production",
      NEXT_PUBLIC_APP_URL: `http://localhost:${e2ePort}`,
      S3_ENDPOINT: process.env.TEST_S3_ENDPOINT ?? process.env.S3_ENDPOINT ?? "http://localhost:9000",
      S3_ACCESS_KEY: process.env.TEST_S3_ACCESS_KEY ?? process.env.S3_ACCESS_KEY ?? "minioadmin",
      S3_SECRET_KEY: process.env.TEST_S3_SECRET_KEY ?? process.env.S3_SECRET_KEY ?? "minioadmin",
      S3_BUCKET: process.env.TEST_S3_BUCKET ?? process.env.S3_BUCKET ?? "habithop-private",
    },
  },
});
