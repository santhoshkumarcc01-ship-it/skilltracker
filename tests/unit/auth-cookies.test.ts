import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { setAuthCookies } from "@/backend/lib/auth/cookies";

describe("authentication cookie policy", () => {
  it("keeps tokens HttpOnly with Lax same-site and scopes refresh to auth", () => {
    const response = NextResponse.next();
    setAuthCookies(response, { accessToken: "access-value", refreshToken: "refresh-value", refreshExpiresAt: new Date(Date.now() + 60_000) });
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toContain("habithop_access=access-value");
    expect(header).toContain("habithop_refresh=refresh-value");
    expect(header.match(/HttpOnly/g)).toHaveLength(2);
    expect(header.match(/SameSite=Lax/gi)).toHaveLength(2);
    expect(header).toContain("Path=/api/v1/auth");
  });
});
