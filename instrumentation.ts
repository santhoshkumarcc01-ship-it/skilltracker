export async function register() {
  // Importing this module validates required server configuration before requests are served.
  await import("./src/server/lib/env");
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeDummyPasswordHash } = await import("./src/server/lib/auth/password");
    await initializeDummyPasswordHash();
  }
}
