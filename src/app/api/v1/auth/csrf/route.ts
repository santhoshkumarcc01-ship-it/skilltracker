import { randomBytes } from "node:crypto";
import { dataResponse } from "@/server/lib/api";
import { setCsrfCookie } from "@/server/lib/auth/cookies";

export async function GET() {
  const token = randomBytes(32).toString("base64url");
  const response = dataResponse({ csrfToken: token });
  setCsrfCookie(response, token);
  return response;
}

