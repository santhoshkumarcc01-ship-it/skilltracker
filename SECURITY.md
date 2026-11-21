# HabitHop security controls

This checklist describes the baseline implemented in this repository. Authentication is email plus password only: there is no OTP, email verification, or magic-link flow.

## Implemented controls

- [x] **Password storage:** Argon2id (`memoryCost: 19,456 KiB`, `timeCost: 2`, `parallelism: 1`, 32-byte hash) in [`password.ts`](./src/server/lib/auth/password.ts). Login always verifies either the stored hash or a lazily boot/first-use initialized dummy Argon2id hash when the email is unknown.
- [x] **Access and refresh tokens:** 15-minute HS256 JWTs and 7-day cryptographically random opaque refresh tokens in [`tokens.ts`](./src/server/lib/auth/tokens.ts). JWT issuer, audience, algorithm, expiration, subject, and session ID are checked.
- [x] **Refresh rotation and reuse response:** Session stores only a SHA-256 refresh-token hash and a family ID. Rotation atomically revokes the previous session and creates its successor. Reuse of a revoked token revokes the whole family and writes a `token_reuse` audit entry in [`auth-service.ts`](./src/server/services/auth-service.ts) and [`auth-repository.ts`](./src/server/repositories/auth-repository.ts).
- [x] **Cookie flags:** Access cookie is HttpOnly, SameSite=Lax, root-scoped, and Secure in production. Refresh cookie has the same flags and is scoped to `/api/v1/auth`. Auth tokens are not returned in API JSON or stored in browser local storage. See [`cookies.ts`](./src/server/lib/auth/cookies.ts).
- [x] **Credential enumeration resistance:** Login uses the same exact `Invalid email or password` response for an unknown email and a wrong password. Signup performs the Argon2id hash before the unique insert and returns the same generic response for a duplicate email; a newly created account receives cookies to continue onboarding.
- [x] **Login lockout:** Five failed attempts for the IP + normalized email pair within a 15-minute window produce a 15-minute lock and `Retry-After`. The adapter contract and in-memory implementation are in [`rate-limit.ts`](./src/server/lib/rate-limit.ts). Replace it with a shared Redis adapter when deploying multiple server instances.
- [x] **CSRF protection:** All mutating `/api/v1` requests pass a middleware Origin/Host/scheme comparison and a double-submit cookie/header check. Route handlers also call the reusable `assertCsrf` helper. The CSRF cookie is intentionally readable by browser JavaScript; access and refresh cookies remain HttpOnly.
- [x] **Security headers:** [`middleware.ts`](./middleware.ts) applies a nonce-based strict script CSP with `strict-dynamic`, `frame-ancestors 'none'`, HSTS in production, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, and `Cross-Origin-Opener-Policy`. Inline styles are permitted for the current CSS/animated UI; development CSP alone permits `unsafe-eval` for the dev runtime.
- [x] **Route protection:** Middleware protects every non-public page and every `/api/v1` route except `/api/v1/auth`. API handlers such as `/me` also call [`requireUser`](./src/server/middleware/require-user.ts), which verifies the JWT and checks for a live, unrevoked database session.
- [x] **Ownership boundary:** [`assertOwnership`](./src/server/middleware/ownership.ts) returns a not-found response for mismatched owners. Account/profile repositories scope reads and writes to the authenticated user ID; no endpoint accepts a caller-selected owner ID.
- [x] **Validation and response shape:** Zod schemas live in [`auth.ts`](./src/server/validators/auth.ts); [`withZodValidation`](./src/server/lib/validation.ts) parses request JSON. API handlers and the `/api/v1` fallback return only `{ data }` or `{ error: { code, message } }`. [`api.ts`](./src/server/lib/api.ts) maps unexpected exceptions to a generic 500 and never serializes a stack trace or raw error message.
- [x] **Audit and structured logging:** Signup, login success/failure, logout, lockout, token reuse, and account deletion write `AuditLog` rows and JSON logs. Email and IP values are HMAC fingerprints; passwords, token values, and full email addresses are never logged. Implemented in [`audit.ts`](./src/server/lib/audit.ts) and [`audit-repository.ts`](./src/server/repositories/audit-repository.ts).
- [x] **Profile defaults:** Signup creates a profile with a unique 10-character Crockford-base32 friend token, `timezone: UTC`, `dailyGoal: 3`, and `onboarded: false`. See [`schema.prisma`](./prisma/schema.prisma) and [`auth-service.ts`](./src/server/services/auth-service.ts).
- [x] **Data export and deletion:** `GET /api/v1/me/export` returns the current account, profile, non-secret session metadata, and audit history. `DELETE /api/v1/me` requires the current password, deletes the account/profile/sessions, and clears auth cookies. Audit rows are retained with their user relation detached and only HMAC email/IP fingerprints; no password or token is retained.
- [x] **Frontend session handling:** TanStack Query uses cookie-authenticated requests, proactively rotates refresh credentials every 12 minutes, and also silently refreshes after an access-token 401. Login/signup use shared Zod schemas, show inline validation errors, and never persist tokens in local storage. The authenticated app guard routes incomplete profiles to onboarding.
- [x] **Tests:** Unit tests cover Argon2id hashing, rate-limit lockout, and refresh-token state. Database integration tests cover signup/login/rotation/logout, family revocation on token reuse, generic duplicate signup, unauthenticated 401, CSRF rejection, and IDOR helper behavior. Playwright covers signup → onboarding → dashboard → logout → login.
- [x] **Timezone date lock:** Task routes derive today with `Intl.DateTimeFormat` and the authenticated user's stored `Profile.timezone`; create, update, start, delete, and completion requests reject any other local date with 403. See [`habit-service.ts`](./src/server/services/habit-service.ts) and [`habit-math.ts`](./src/server/lib/habit-math.ts).
- [x] **Timer-backed completion:** Task sessions persist `startedAt`, `elapsedSeconds`, and `timerRunningSince`; task completion requires a configurable `TASK_COMPLETION_FRACTION` of its planned duration. The server calculates elapsed time and XP, applies the on-time bonus, and awards a daily chest once through a conditional DayLog update. See [`habit-repository.ts`](./src/server/repositories/habit-repository.ts).
- [x] **Streak and freeze accounting:** `DayLog` and `UserStats` persist completed/partial/missed/frozen dates, longest/current streak, XP, gems, and freeze inventory. Missed dates are lazily detected by dashboard/calendar reads; available freezes cost 200 XP and are consumed once per missed day to preserve a streak. Pure timezone, DST, leap-day, streak, freeze, and level formulas are covered in [`habit-math.test.ts`](./tests/unit/habit-math.test.ts).
- [x] **Task ownership:** Task lookups and mutations are scoped by the authenticated user ID in [`habit-repository.ts`](./src/server/repositories/habit-repository.ts); date-lock and cross-user editing cases are covered in [`habit.integration.test.ts`](./tests/integration/habit.integration.test.ts).
- [x] **Supabase Data API isolation:** HabitHop's tables have RLS enabled and `anon`/`authenticated` Data API roles have no table privileges. Data access runs through the app's authenticated Prisma repositories. The deployment migration is [`20261121001000_lock_down_supabase_data_api/migration.sql`](./prisma/migrations/20261121001000_lock_down_supabase_data_api/migration.sql).
- [x] **Supabase schema integrity:** Prisma migrations are baselined against the existing Supabase database. Ownership and media foreign keys are enforced for new writes; legacy orphan records are retained pending an explicit cleanup decision. Public execution of the event-trigger helper `rls_auto_enable()` is revoked by [`20261121000000_enforce_media_ownership/migration.sql`](./prisma/migrations/20261121000000_enforce_media_ownership/migration.sql).

## Deployment requirements

- Set a random `JWT_SECRET` of at least 32 characters and keep it out of source control. Rotate it by signing out all sessions.
- Serve the app only over HTTPS in production. Configure the trusted reverse proxy to overwrite `X-Real-IP` or `X-Forwarded-For`; `requestIp()` uses those headers for rate-limit keys.
- The in-memory login limiter is per process and resets on restart. Use a shared Redis implementation before running multiple instances or relying on lockout as a distributed control.
- Keep PostgreSQL private and encrypted/backed up. Restrict database access and consider a retention schedule for redacted audit rows.
- Review CSP sources before adding third-party scripts, images, analytics, or API hosts. Keep the production script policy nonce-based.
- Keep the local `.env` credentials out of production and replace them with managed secrets.

## Quality-pass verification map

| Control | Automated verification |
| --- | --- |
| Password hashing and unknown-user login work | `tests/unit/password.test.ts`, `tests/integration/auth.integration.test.ts` |
| Refresh rotation and revoked-token state | `tests/unit/refresh-state.test.ts`, `tests/integration/auth.integration.test.ts` |
| Login throttling and `Retry-After` | `tests/unit/rate-limit.test.ts`, `tests/integration/auth.integration.test.ts` |
| Cookie HttpOnly, SameSite, and refresh path | `tests/unit/auth-cookies.test.ts` |
| CSP, HSTS, security headers, CSRF rejection, API auth gate, and method envelope | `tests/unit/middleware-security.test.ts`; route CSRF is also exercised in `tests/integration/auth.integration.test.ts` |
| All API handlers keep an auth/session check, CSRF on mutations, or cron bearer validation | `tests/unit/route-security-inventory.test.ts` |
| Cross-user resource denial | `tests/integration/habit.integration.test.ts`, `friends.integration.test.ts`, `materials.integration.test.ts`, `motivation.integration.test.ts`, `story.integration.test.ts`, and `reports.integration.test.ts` |
| Upload MIME/size/URL policies and sanitized note content | `tests/unit/storage-rules.test.ts`, `materials.test.ts`, `tests/integration/story.integration.test.ts`, `materials.integration.test.ts` |
| Cron secret rejects missing credentials | `tests/unit/report-cron-auth.test.ts`, `tests/integration/reports.integration.test.ts` |

The route inventory is a static guard for handler-level authentication and CSRF, not an HTTP IDOR probe against every endpoint. Cross-owner integration cases cover the resource families listed above, but not every method on every route. The local quality pass also could not run live PostgreSQL query plans or Lighthouse/browser viewport audits; deployment CI is configured to run database suites, production build, and E2E in its service-enabled runner.

## Threat model

| Asset | Threat | Mitigation |
| --- | --- | --- |
| Passwords and account identity | Credential theft, guessing, and account enumeration | Argon2id hashes; dummy-hash verification; generic login errors; IP + normalized-email lockout; no password/token logging. |
| Access and refresh sessions | Theft, replay, fixation, or reuse after rotation | HttpOnly SameSite cookies, Secure in production, 15-minute access JWT, hashed rotating refresh tokens, family revocation on reuse, CSRF double-submit. |
| Profile, tasks, reports, and saved content | Cross-account reads/writes (IDOR) | Authenticated identity comes from the live DB session; repository operations scope by that user; ownership failures are not-found; route inventory and cross-user service integration tests. |
| Uploaded media | Malicious content, public exposure, MIME spoofing, oversized objects | Private bucket, short-lived signed URLs, per-user random keys, declared and sniffed type/size checks, image re-encoding, ownership checks, upload rate limit. |
| External media URLs | SSRF or unsafe iframe origins | URLs are parsed and stored without server fetches; embed host allowlist; iframe sandbox and CSP frame-source allowlist. |
| Browser session and rendered UI | CSRF, script injection, clickjacking, information leakage | Origin + double-submit CSRF, nonce CSP, frame denial, strict headers, server/client rich-text sanitization, no email in report image. |
| Friend/social data | Token guessing, unauthorized relationship access, privacy leakage | Generic invite result, per-user lookup throttling, friendship/goal membership checks, sharing preferences, memories excluded from friend activity. |
| Scheduled jobs and database | Unauthorized cron invocation, data loss, downtime | Bearer secret checks, health route, PostgreSQL and bucket backup guidance; monitor the cron results and restore both stores together. |
