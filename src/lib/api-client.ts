export class ApiClientError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

type ApiEnvelope<T> = { data: T } | { error: { code: string; message: string } };

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  return document.cookie.split("; ").map((part) => part.trim()).find((part) => part.startsWith("habithop_csrf="))?.slice("habithop_csrf=".length) ?? null;
}

async function getCsrfToken(): Promise<string> {
  const existing = readCsrfCookie();
  if (existing) return existing;
  const response = await fetch("/api/v1/auth/csrf", { credentials: "include", cache: "no-store" });
  const payload = await response.json() as ApiEnvelope<{ csrfToken: string }>;
  if (!response.ok || !("data" in payload)) throw new ApiClientError("Could not initialize a secure request.", response.status, "CSRF_INIT_FAILED");
  return payload.data.csrfToken;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (!new Set(["GET", "HEAD", "OPTIONS"]).has(method)) headers.set("x-csrf-token", await getCsrfToken());
  const response = await fetch(path, { ...init, method, headers, credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    const error = payload && "error" in payload ? payload.error : { code: "REQUEST_FAILED", message: "Something went wrong. Please try again." };
    throw new ApiClientError(error.message, response.status, error.code);
  }
  return payload.data;
}

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  profile: { friendToken: string; timezone: string; dailyGoal: number; pet: string | null; onboarded: boolean } | null;
};

let refreshInFlight: Promise<CurrentUser> | null = null;

export function refreshSession(): Promise<CurrentUser> {
  refreshInFlight ??= apiRequest<{ user: CurrentUser }>("/api/v1/auth/refresh", { method: "POST" })
    .then((result) => result.user)
    .finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  try {
    return (await apiRequest<{ user: CurrentUser }>("/api/v1/auth/me")).user;
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.status !== 401) throw error;
    await refreshSession();
    return (await apiRequest<{ user: CurrentUser }>("/api/v1/auth/me")).user;
  }
}

