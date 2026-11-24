// @vitest-environment node
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/backend/lib/prisma";
import { getWeeklyReport } from "@/backend/services/reports/report-service";
import { GET as cronGet } from "@/app/api/v1/cron/weekly-reports/route";

const users: string[] = [];
async function user() {
  const email = `report-${randomUUID()}@example.test`;
  const record = await prisma.user.create({ data: { email, passwordHash: "test", displayName: "Report Hopper", profile: { create: { friendToken: randomUUID().replaceAll("-", "").slice(0, 10), timezone: "UTC" } }, stats: { create: { xp: 120 } } } });
  users.push(record.id); return record;
}
afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: users } } }); users.length = 0; });
afterAll(async () => { await prisma.$disconnect(); });

describe("weekly report ownership and persistence", () => {
  it("rejects cron requests without the configured bearer secret", async () => {
    const response = await cronGet(new NextRequest("http://localhost/api/v1/cron/weekly-reports"));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "CRON_UNAUTHORIZED" } });
  });

  it("generates and stores a report only within the requested user's scope", async () => {
    const owner = await user(); const stranger = await user();
    const report = await getWeeklyReport(owner.id, "2026-11-16", new Date("2026-11-20T12:00:00Z"));
    expect(report).toMatchObject({ userId: owner.id, weekStart: "2026-11-16" });
    expect(await prisma.weeklyReport.count({ where: { userId: owner.id } })).toBe(1);
    expect(await prisma.weeklyReport.count({ where: { userId: stranger.id } })).toBe(0);
  });
});
