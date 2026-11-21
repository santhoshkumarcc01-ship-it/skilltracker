// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/lib/prisma";
import { createFolder, createMaterial, deleteFolder, getMaterial } from "@/server/services/material-service";
import { createMaterialSchema } from "@/server/validators/materials";

const emails: string[] = [];
async function newUser() {
  const email = `library-${randomUUID()}@example.test`; emails.push(email);
  return prisma.user.create({ data: { email, passwordHash: "test-only", displayName: "Library Tester", profile: { create: { friendToken: randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase() } } } });
}
afterEach(async () => { await prisma.user.deleteMany({ where: { email: { in: emails } } }); emails.length = 0; });
afterAll(async () => { await prisma.$disconnect(); });

describe("Material Library ownership and folders", () => {
  it("does not reveal another user's material", async () => {
    const owner = await newUser(); const other = await newUser();
    const created = await createMaterial(owner.id, createMaterialSchema.parse({ type: "NOTE", title: "Owned note", content: "<p>Private</p>", tags: [] }));
    await expect(getMaterial(other.id, created.material.id)).rejects.toMatchObject({ status: 404, code: "MATERIAL_NOT_FOUND" });
  });

  it("cascades folder deletion through nested folders and unassigns materials", async () => {
    const owner = await newUser();
    const parent = await createFolder(owner.id, { name: "Science", color: "green" });
    const child = await createFolder(owner.id, { name: "Biology", parentId: parent.id, color: "blue" });
    const created = await createMaterial(owner.id, createMaterialSchema.parse({ type: "NOTE", title: "Cells", content: "<p>Cell notes</p>", tags: [], folderId: child.id }));
    await deleteFolder(owner.id, parent.id);
    expect(await prisma.materialFolder.findMany({ where: { userId: owner.id } })).toHaveLength(0);
    expect(await prisma.material.findUniqueOrThrow({ where: { id: created.material.id } })).toMatchObject({ folderId: null, userId: owner.id });
  });
});
