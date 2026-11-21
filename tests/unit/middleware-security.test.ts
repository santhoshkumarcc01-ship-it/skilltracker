import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

describe("security middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects protected API reads without an access cookie", async () => {
    const response = await proxy(new NextRequest("http://localhost/api/v1/tasks"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
  });

  it("rejects mutations without same-origin and double-submit CSRF values", async () => {
    const request = new NextRequest("http://localhost/api/v1/tasks", { method: "POST", headers: { host: "localhost" } });
    const response = await proxy(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "CSRF_REJECTED" } });
  });

  it("sets baseline headers and a nonce-based CSP", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest("https://habithop.example/api/v1/auth/csrf");
    const response = await proxy(request);
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self' 'nonce-");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("strict-transport-security")).toContain("max-age=63072000");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("returns the normal API envelope for an unsupported known route method", async () => {
    const response = await proxy(new NextRequest("http://localhost/api/v1/tasks", { method: "PUT" }));
    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({ error: { code: "METHOD_NOT_ALLOWED" } });
  });
});

