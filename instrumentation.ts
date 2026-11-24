export async function register() {
  // Importing this module validates required server configuration before requests are served.
  await import("./src/backend/lib/env");
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeDummyPasswordHash } = await import("./src/backend/lib/auth/password");
    await initializeDummyPasswordHash();
  }
}
