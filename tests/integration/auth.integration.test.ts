// @vitest-environment node
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/server/lib/api";
import { assertCsrf } from "@/server/lib/csrf";
import { prisma } from "@/server/lib/prisma";
import { login, logout, refresh, signup } from "@/server/services/auth-service";
import { loginSchema } from "@/server/validators/auth";
import { requireUser } from "@/server/middleware/require-user";
import { assertOwnership } from "@/server/middleware/ownership";
import { signupSchema } from "@/server/validators/auth";
import { POST as signupPost } from "@/app/api/v1/auth/signup/route";
import { GET as authMeGet } from "@/app/api/v1/auth/me/route";

const createdEmails: string[] = [];
const testRequest = () => new Request("http://localhost/api/v1/auth/test", { headers: { "x-real-ip": "127.0.0.1" } });
const credentials = () => {
  const email = `auth-${randomUUID()}@example.test`;
  createdEmails.push(email);
  return signupSchema.parse({ displayName: "Hop Tester", email, password: "Correct-Habit-42", confirmPassword: "Correct-Habit-42" });
};

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  createdEmails.length = 0;
});
afterAll(async () => { await prisma.$disconnect(); });

describe("auth service flows", () => {
  it("signs up, logs in, rotates refresh tokens, and logs out", async () => {
    const input = credentials();
    const initialTokens = await signup(input, testRequest());
    expect(initialTokens?.refreshToken).toBeTruthy();
    const loggedIn = await login({ email: input.email, password: input.password }, testRequest());
    const rotated = await refresh(loggedIn.tokens.refreshToken, testRequest());
    expect(rotated.tokens.refreshToken).not.toBe(loggedIn.tokens.refreshToken);
    await logout(rotated.tokens.refreshToken, testRequest());
    await expect(refresh(rotated.tokens.refreshToken, testRequest())).rejects.toMatchObject({ status: 401 });
  });

  it("revokes the entire token family when a rotated refresh token is reused", async () => {
    const input = credentials();
    const first = await signup(input, testRequest());
    expect(first).not.toBeNull();
    const second = await refresh(first!.refreshToken, testRequest());
    await expect(refresh(first!.refreshToken, testRequest())).rejects.toMatchObject({ status: 401 });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: input.email } });
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    expect(sessions.length).toBe(2);
    expect(sessions.every((session) => session.revokedAt !== null)).toBe(true);
    await expect(refresh(second.tokens.refreshToken, testRequest())).rejects.toMatchObject({ status: 401 });
  });

  it("returns a generic duplicate-signup result", async () => {
    const input = credentials();
    const first = await signup(input, testRequest());
    const duplicate = await signup(input, testRequest());
    expect(first).not.toBeNull();
    expect(duplicate).toBeNull();
  });

  it("uses a generic failure then returns Retry-After after five failed attempts", async () => {
    const input = loginSchema.parse({ email: `unknown-${randomUUID()}@example.test`, password: "Wrong-Habit-42" });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(login(input, testRequest())).rejects.toMatchObject({ status: 401, message: "Invalid email or password" });
    }
    await expect(login(input, testRequest())).rejects.toMatchObject({ status: 429, message: "Invalid email or password", headers: { "Retry-After": "900" } });
  });
});

describe("security boundaries", () => {
  it("returns a 401 envelope for unauthenticated access", async () => {
    const response = await authMeGet(new NextRequest("http://localhost/api/v1/auth/me"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } });
    await expect(requireUser(new NextRequest("http://localhost/api/v1/auth/me"))).rejects.toMatchObject({ status: 401 });
  });

  it("rejects cross-origin or missing double-submit CSRF tokens", () => {
    const crossOrigin = new NextRequest("http://localhost/api/v1/auth/signup", { method: "POST", headers: { host: "localhost", origin: "http://attacker.test" } });
    expect(() => assertCsrf(crossOrigin)).toThrow(ApiError);
    const noToken = new NextRequest("http://localhost/api/v1/auth/signup", { method: "POST", headers: { host: "localhost", origin: "http://localhost" } });
    expect(() => assertCsrf(noToken)).toThrow(ApiError);
  });

  it("rejects a cross-user resource owner as IDOR scaffolding", () => {
    expect(() => assertOwnership("user-one", "user-two")).toThrowError(/Resource not found/);
    expect(() => assertOwnership("user-one", "user-one")).not.toThrow();
  });

  it("rejects CSRF at the route boundary before attempting signup", async () => {
    const request = new NextRequest("http://localhost/api/v1/auth/signup", {
      method: "POST", headers: { host: "localhost", origin: "http://attacker.test", "content-type": "application/json" },
      body: JSON.stringify({ displayName: "Tester", email: "csrf@example.test", password: "Correct-Habit-42", confirmPassword: "Correct-Habit-42" }),
    });
    const response = await signupPost(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "CSRF_REJECTED" } });
  });
});
