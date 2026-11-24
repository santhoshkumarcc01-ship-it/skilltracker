import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/backend/lib/auth/password";

describe("password hashing", () => {
  it("hashes with Argon2id and verifies without storing the cleartext", async () => {
    const password = "Hopping!Across2026";
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });
});
