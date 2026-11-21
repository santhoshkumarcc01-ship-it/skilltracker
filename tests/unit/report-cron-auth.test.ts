import { describe, expect, it } from "vitest";
import { hasValidCronAuthorization } from "@/server/lib/reports/cron-auth";

describe("weekly report cron authorization", () => {
  it("requires the configured bearer secret and rejects missing or incorrect values", () => {
    expect(hasValidCronAuthorization("Bearer report-secret-long-enough", "report-secret-long-enough")).toBe(true);
    expect(hasValidCronAuthorization("Bearer wrong", "report-secret-long-enough")).toBe(false);
    expect(hasValidCronAuthorization(null, "report-secret-long-enough")).toBe(false);
    expect(hasValidCronAuthorization("Bearer report-secret-long-enough")).toBe(false);
  });
});
