// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { createMemory, getMemory, removeMemory } from "@/server/services/memory-service";
import { createMemorySchema } from "@/server/validators/memories";

const emails: string[] = [];
async function newUser() {
  const email = `story-${randomUUID()}@example.test`;
  emails.push(email);
  return prisma.user.create({ data: { email, passwordHash: "test-only" , displayName: "Story Tester", profile: { create: { friendToken: randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase() } } } });
}
const memoryInput = (sourceUrl: string) => createMemorySchema.parse({ title: "First light", story: "A quiet morning.\nA good memory.", tags: ["morning"], occurredAt: "2026-11-19", mood: "😊", sourceUrl });

afterEach(async () => { await prisma.user.deleteMany({ where: { email: { in: emails } } }); emails.length = 0; });
afterAll(async () => { await prisma.$disconnect(); });

describe("Story Corner ownership", () => {
  it("does not reveal or delete another user's memory", async () => {
    const owner = await newUser();
    const other = await newUser();
    const created = await createMemory(owner.id, memoryInput("https://example.test/story"));
    await expect(getMemory(other.id, created.memory.id)).rejects.toMatchObject({ status: 404, code: "MEMORY_NOT_FOUND" });
    await expect(removeMemory(other.id, created.memory.id)).rejects.toMatchObject({ status: 404, code: "MEMORY_NOT_FOUND" });
    expect(await prisma.memory.findUniqueOrThrow({ where: { id: created.memory.id } })).toMatchObject({ userId: owner.id, title: "First light" });
  });

  it("rejects attaching a file owned by another user", async () => {
    const owner = await newUser();
    const other = await newUser();
    const file = await prisma.storedFile.create({ data: { userId: owner.id, objectKey: `${owner.id}/${randomUUID()}.png`, mimeType: "image/png", size: 32 } });
    await expect(createMemory(other.id, createMemorySchema.parse({ title: "Not yours", story: "", tags: [], occurredAt: "2026-11-19", mood: null, mediaFileId: file.id }))).rejects.toMatchObject({ status: 404, code: "FILE_NOT_FOUND" });
  });
});
