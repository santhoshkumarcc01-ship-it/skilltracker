import { spawn } from "node:child_process";

const port = 3101;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  env: { ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port), NODE_ENV: "production" },
  stdio: "ignore",
});

try {
  let response;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Standalone server exited with code ${server.exitCode}.`);
    try {
      response = await fetch(origin);
      if (response.ok) break;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  if (!response?.ok) throw new Error("Standalone server did not return the landing page.");
  const html = await response.text();
  const cssPaths = [...html.matchAll(/<link[^>]+href="([^"]+\.css(?:\?[^"]*)?)"[^>]*>/g)].map((match) => match[1]);
  if (cssPaths.length === 0) throw new Error("Landing page did not include a stylesheet.");

  for (const assetPath of cssPaths) {
    const cssResponse = await fetch(new URL(assetPath, origin));
    if (!cssResponse.ok) throw new Error(`Production stylesheet returned HTTP ${cssResponse.status}: ${assetPath}`);
    const css = await cssResponse.text();
    if (!css.includes(".bg-canvas")) throw new Error(`Production stylesheet is missing the app utility tokens: ${assetPath}`);
  }

  console.info(`Standalone production smoke passed (${cssPaths.length} stylesheet(s) loaded).`);
} finally {
  server.kill();
}
