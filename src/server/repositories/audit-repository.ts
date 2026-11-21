import { prisma } from "@/server/lib/prisma";

export async function createAuditRecord(data: {
  action: string;
  userId?: string;
  emailHash?: string;
  ipHash?: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  return prisma.auditLog.create({ data });
}
