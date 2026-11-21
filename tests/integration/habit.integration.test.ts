// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { addLocalDays } from "@/server/lib/habit-math";
import { signup } from "@/server/services/auth-service";
import { addTask, finishTask, todayForUser, updateTimer, editTask } from "@/server/services/habit-service";
import { buyShopItem, getShop } from "@/server/services/game-service";
import { signupSchema } from "@/server/validators/auth";

const emails: string[] = [];
const request = () => new Request("http://localhost/api/v1/auth/signup", { headers: { "x-real-ip": "127.0.0.1" } });
async function newUser() {
  const email = `habit-${randomUUID()}@example.test`;
  emails.push(email);
  const input = signupSchema.parse({ displayName: "Habit Tester", email, password: "Correct-Habit-42", confirmPassword: "Correct-Habit-42" });
  const result = await signup(input, request());
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { user, result };
}

afterEach(async () => { await prisma.user.deleteMany({ where: { email: { in: emails } } }); emails.length = 0; });
afterAll(async () => { await prisma.$disconnect(); });

describe("today task boundaries and ownership", () => {
  it("rejects task creation for tomorrow using the stored profile timezone", async () => {
    const { user } = await newUser();
    const today = await todayForUser(user.id);
    await expect(addTask(user.id, { localDate: addLocalDays(today, 1), title: "Locked", category: "Learning", scheduledStart: "09:00", plannedMinutes: 15 })).rejects.toMatchObject({ status: 403, code: "DATE_LOCKED" });
    await expect(addTask(user.id, { localDate: addLocalDays(today, -1), title: "Read only", category: "Learning", scheduledStart: "09:00", plannedMinutes: 15 })).rejects.toMatchObject({ status: 403, code: "DATE_LOCKED" });
  });

  it("does not allow another user's ID to edit a task", async () => {
    const { user: owner } = await newUser();
    const { user: other } = await newUser();
    const localDate = await todayForUser(owner.id);
    const task = await addTask(owner.id, { localDate, title: "Owner task", category: "Learning", scheduledStart: "09:00", plannedMinutes: 10 });
    await expect(editTask(other.id, task.id, { localDate: await todayForUser(other.id), title: "Stolen" })).rejects.toMatchObject({ status: 404, code: "TASK_NOT_FOUND" });
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ userId: owner.id, title: "Owner task" });
  });
});

describe("task completion reward flow", () => {
  it("requires a started timer, then completes the day and increments streak", async () => {
    const { user } = await newUser();
    const localDate = await todayForUser(user.id);
    const scheduledStart = new Date(Date.now() + 5 * 60_000).toISOString().slice(11, 16);
    const task = await addTask(user.id, { localDate, title: "Read one page", category: "Learning", scheduledStart, plannedMinutes: 1 });
    await expect(finishTask(user.id, task.id, localDate)).rejects.toMatchObject({ status: 409, code: "TIMER_INCOMPLETE" });
    await updateTimer(user.id, task.id, localDate, "start");
    await prisma.task.update({ where: { id: task.id }, data: { startedAt: new Date(Date.now() - 16_000), timerRunningSince: new Date(Date.now() - 16_000) } });
    const completed = await finishTask(user.id, task.id, localDate);
    expect(completed).toMatchObject({ dayComplete: true, xp: 15, chest: { xp: 15 } });
    expect(await prisma.userStats.findUniqueOrThrow({ where: { userId: user.id } })).toMatchObject({ currentStreak: 1, longestStreak: 1 });
    expect(await prisma.dayLog.findUniqueOrThrow({ where: { userId_localDate: { userId: user.id, localDate } } })).toMatchObject({ status: "COMPLETED" });
  });
});

describe("pet shop transaction safety", () => {
  it("charges once for concurrent purchases and never allows a negative balance", async () => {
    const { user } = await newUser();
    await prisma.userStats.upsert({ where: { userId: user.id }, create: { userId: user.id, gems: 100 }, update: { gems: 100 } });
    const shop = await getShop(user.id);
    const item = shop.items.find((entry) => entry.id === "sunny-cap");
    expect(item).toBeDefined();
    const outcomes = await Promise.allSettled([buyShopItem(user.id, "sunny-cap"), buyShopItem(user.id, "sunny-cap")]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(await prisma.userStats.findUniqueOrThrow({ where: { userId: user.id } })).toMatchObject({ gems: 65 });
    await prisma.userStats.update({ where: { userId: user.id }, data: { gems: 20 } });
    await expect(buyShopItem(user.id, "star-crown")).rejects.toMatchObject({ code: "NOT_ENOUGH_GEMS" });
    expect((await prisma.userStats.findUniqueOrThrow({ where: { userId: user.id } })).gems).toBe(20);
  });
});
