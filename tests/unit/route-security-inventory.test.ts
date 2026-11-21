import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routesRoot = path.join(process.cwd(), "src", "app", "api", "v1");
const publicExceptions = new Set([
  "auth/csrf/route.ts",
  "auth/signup/route.ts",
  "auth/login/route.ts",
  "auth/refresh/route.ts",
  "auth/logout/route.ts",
]);
const cronExceptions = new Set(["cron/weekly-reports/route.ts", "cron/missed-days/route.ts"]);
const fallbackRoute = "[[...path]]/route.ts";

async function listRoutes(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) return listRoutes(path.join(directory, entry.name), relative);
    return entry.name === "route.ts" ? [relative] : [];
  }));
  return nested.flat();
}

describe("API route security inventory", () => {
  it("keeps every authenticated route session-gated and every mutation CSRF-checked", async () => {
    const routes = await listRoutes(routesRoot);
    expect(routes.length).toBeGreaterThan(30);

    for (const route of routes) {
      const normalized = route.split(path.sep).join("/");
      const source = await readFile(path.join(routesRoot, route), "utf8");
      if (publicExceptions.has(normalized) || normalized === fallbackRoute) continue;

      if (cronExceptions.has(normalized)) {
        expect(source, `${normalized} must validate the cron secret`).toContain("hasValidCronAuthorization");
        continue;
      }

      expect(source, `${normalized} must re-check the authenticated database session`).toContain("requireUser(");
      const hasMutatingHandler = /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/.test(source)
        || /export\s+const\s+(?:POST|PUT|PATCH|DELETE)\s*=/.test(source);
      if (hasMutatingHandler) expect(source, `${normalized} must enforce CSRF on writes`).toContain("assertCsrf(");
    }
  });
});
