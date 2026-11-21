// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { createMotivationNote, removeMotivationNote, updateMotivationNote } from "@/server/services/motivation/motivation-service";

const userIds: string[] = [];
async function newUser() {
  const user = await prisma.user.create({ data: { email: `motivation-${randomUUID()}@example.test`, passwordHash: "integration", displayName: "Motivation Test", profile: { create: { friendToken: randomUUID().replaceAll("-", "").slice(0, 10), timezone: "UTC" } } } });
  userIds.push(user.id); return user;
}
afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: userIds } } }); userIds.length = 0; });
afterAll(async () => { await prisma.$disconnect(); });

describe("Motivation Corner ownership and limits", () => {
  it("rejects edits and deletes from a different owner", async () => {
    const owner = await newUser(); const stranger = await newUser();
    const note = await createMotivationNote(owner.id, { kind: "STICKY", text: "Keep going", quote: null, attribution: null, fileId: null, color: "lemon", paperStyle: "lined", x: 5, y: 5, width: 24, height: 28, rotation: 0, zIndex: 1, pinned: false });
    await expect(updateMotivationNote(stranger.id, note.id, { text: "intrusion" })).rejects.toMatchObject({ status: 404 });
    await expect(removeMotivationNote(stranger.id, note.id)).rejects.toMatchObject({ status: 404 });
    expect(await prisma.motivationNote.count({ where: { userId: owner.id, id: note.id } })).toBe(1);
  });

  it("caps a user's board at one hundred items", async () => {
    const owner = await newUser();
    await prisma.motivationNote.createMany({ data: Array.from({ length: 100 }, (_, index) => ({ userId: owner.id, kind: "STICKY", text: `Note ${index}`, color: "lemon", paperStyle: "lined", x: 1, y: 1, width: 24, height: 28, rotation: 0, zIndex: index + 1 })) });
    await expect(createMotivationNote(owner.id, { kind: "STICKY", text: "One too many", quote: null, attribution: null, fileId: null, color: "lemon", paperStyle: "lined", x: 5, y: 5, width: 24, height: 28, rotation: 0, zIndex: 101, pinned: false })).rejects.toMatchObject({ status: 409, code: "BOARD_LIMIT_REACHED" });
  });
});
