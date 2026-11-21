// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { blockFriend, createSharedGoal, getDuoStreak, inviteByToken, markSharedGoalProgress, pokeFriend, respondToInvite } from "@/server/services/friend-service";

const users: { email: string; id: string }[] = [];
async function newUser() {
  const email = `friends-${randomUUID()}@example.test`;
  const friendToken = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  const user = await prisma.user.create({ data: { email, passwordHash: "integration-only", displayName: "Friend Test", profile: { create: { friendToken, timezone: "UTC" } } }, include: { profile: true } });
  users.push({ email, id: user.id }); return user;
}
afterEach(async () => { await prisma.user.deleteMany({ where: { email: { in: users.map((entry) => entry.email) } } }); users.length = 0; });
afterAll(async () => { await prisma.$disconnect(); });

describe("friend invites, blocks, and collaboration ownership", () => {
  it("returns generic token results, accepts an invite, and blocks future connections", async () => {
    const a = await newUser(); const b = await newUser();
    const first = await inviteByToken(a.id, b.profile!.friendToken);
    const absent = await inviteByToken(a.id, "0000000000");
    expect(first).toEqual(absent);
    const invite = await prisma.friendInvite.findFirstOrThrow({ where: { senderId: a.id, receiverId: b.id } });
    await respondToInvite(b.id, invite.id, "ACCEPTED");
    expect(await prisma.friendship.count({ where: { userId: a.id, friendId: b.id } })).toBe(1);
    await blockFriend(a.id, b.id);
    await inviteByToken(b.id, a.profile!.friendToken);
    expect(await prisma.friendInvite.count({ where: { status: "PENDING", OR: [{ senderId: a.id, receiverId: b.id }, { senderId: b.id, receiverId: a.id }] } })).toBe(0);
  });

  it("limits token lookup attempts", async () => {
    const a = await newUser();
    for (let attempt = 0; attempt < 10; attempt += 1) await inviteByToken(a.id, "0000000000");
    await expect(inviteByToken(a.id, "0000000000")).rejects.toMatchObject({ status: 429, code: "INVITE_RATE_LIMITED" });
  });

  it("rejects goal and nudge access without a friendship", async () => {
    const a = await newUser(); const b = await newUser();
    await expect(getDuoStreak(a.id, b.id)).rejects.toMatchObject({ status: 404, code: "FRIEND_NOT_FOUND" });
    await expect(createSharedGoal(a.id, { friendId: b.id, title: "Study", targetDays: 3 })).rejects.toMatchObject({ status: 404, code: "FRIEND_NOT_FOUND" });
    await expect(pokeFriend(a.id, b.id)).rejects.toMatchObject({ status: 404, code: "FRIEND_NOT_FOUND" });
  });

  it("only lets a study-goal member mark progress", async () => {
    const a = await newUser(); const b = await newUser(); const stranger = await newUser();
    await prisma.friendship.createMany({ data: [{ userId: a.id, friendId: b.id }, { userId: b.id, friendId: a.id }] });
    const result = await createSharedGoal(a.id, { friendId: b.id, title: "Read daily", targetDays: 3 });
    await expect(markSharedGoalProgress(stranger.id, result.goal.id)).rejects.toMatchObject({ status: 404, code: "GOAL_NOT_FOUND" });
  });
});
