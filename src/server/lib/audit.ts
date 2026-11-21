import { createHmac } from "node:crypto";
import { env } from "@/server/lib/env";
import { createAuditRecord } from "@/server/repositories/audit-repository";

type AuditEvent = "signup" | "login_success" | "login_failure" | "logout" | "token_reuse" | "lockout" | "account_deleted";

function fingerprint(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return createHmac("sha256", env.JWT_SECRET).update(value).digest("hex").slice(0, 24);
}

export async function writeAudit(event: AuditEvent, fields: {
  userId?: string;
  email?: string;
  ip?: string;
  metadata?: Record<string, string | number | boolean | null>;
} = {}): Promise<void> {
  const emailHash = fingerprint(fields.email);
  const ipHash = fingerprint(fields.ip);
  const safe = {
    event,
    userId: fields.userId,
    emailHash,
    ipHash,
    metadata: fields.metadata,
  };
  console.info(JSON.stringify(safe));
  await createAuditRecord({ action: event, userId: fields.userId, emailHash, ipHash, metadata: fields.metadata });
}
