# HabitHop

HabitHop is a playful daily activity tracker built with Next.js, Prisma, and PostgreSQL. The current foundation includes email/password authentication, account security controls, onboarding, and the shared game UI. Authentication uses no OTP, email verification, or magic links.

## Local setup

1. Install Node.js 20.9 or newer and Docker Compose.
2. Copy `.env.example` to `.env` if you need to reset the development configuration.
3. Start PostgreSQL and private S3-compatible storage: `docker compose up -d`.
4. Install packages: `npm i`.
5. Apply the checked-in Prisma migrations: `npm run db:migrate:deploy`.
6. Start Next.js: `npm run dev`.
7. Visit [http://localhost:3000](http://localhost:3000).

The Compose project creates a private bucket. The local `.env` credentials and `JWT_SECRET` are development-only. Replace them and configure TLS, trusted proxy headers, and a shared rate-limit adapter before deployment.

## Code layout

- `src/frontend` contains reusable React UI, browser-side API/sound/theme utilities, and optional Supabase browser/server helpers.
- `src/backend` contains the server-only validators, services, repositories, middleware, and infrastructure libraries.
- `src/shared` contains isomorphic validation schemas and pure rules used by both UI and backend, such as note sanitization, motivation-board geometry, and XP/level calculations.
- `src/app` contains the Next.js App Router entrypoints. Next requires pages, layouts, and API route handlers to remain in this folder; page files compose frontend components, and API handlers delegate to the backend.

Keep backend code out of client components. Shared code must remain safe to import in both browser and Node.js environments.

## Supabase client setup

The optional Supabase browser and server clients live in `src/frontend/utils/supabase`. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` to use them. The publishable key is intended for browser use; never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable. The root middleware refreshes Supabase Auth sessions only when Supabase Auth cookies are present. HabitHop's existing email/password API, access/refresh cookies, and Prisma repositories remain the app's primary authentication and data path.

Prisma schema changes use `DIRECT_URL` when configured. The existing Supabase database is baselined in Prisma Migrate; apply future checked-in changes with `npm run db:migrate:deploy`. App tables deny direct `anon` and `authenticated` Data API access; requests go through the app's authenticated Prisma backend. Keep database connection strings in ignored `.env` files and rotate credentials that have been shared in chat.

## Visual system and motion

HabitHop's Aurora Arcade visual identity uses semantic CSS variables in `src/app/globals.css`, TypeScript palette and section tokens in `src/frontend/lib/theme`, and Tailwind color/gradient/shadow utilities. Light, dark, and high-contrast previews are available in the app theme control. `src/frontend/lib/motion/tokens.ts` is the motion source of truth; `MotionProvider` combines OS and in-app reduced-motion settings, estimates device capability, and can downgrade effects when frame rate stays below 45 FPS. Components inside `LazyMotion` use the `m.*` primitives. Use `useMotionTier()` before adding expensive effects. See the [visual audit](./docs/aurora-audit.md), [performance baseline](./docs/perf-baseline.md), and [performance results](./docs/perf-after.md) for coverage and current limits.

## Authentication flow

Create an account at `/signup`, complete the pet/goal/time-zone onboarding, and sign in at `/login`. Access JWTs live in an HttpOnly cookie for 15 minutes; rotating opaque refresh tokens live in a path-scoped HttpOnly cookie for 7 days. The browser keeps neither token in local storage.

## Commands

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` / `npm run typecheck`
- `npm run audit` (fail on moderate or higher dependency advisories)
- `npm test` (runs unit and database integration tests; Vitest overrides `DATABASE_URL` to `TEST_DATABASE_URL` or a local PostgreSQL default so it cannot write to the Supabase URL in `.env`)
- `npm run e2e` (starts a fresh Playwright app on port 3100, uses a local-only test database URL, and includes UI, auth-validation, and 3-theme/3-viewport showcase checks)
- `npm run db:generate` / `npm run db:migrate:deploy` / `npm run db:migrate:status`
- `npm run db:push` is for local prototyping only; use reviewed migrations for shared or production databases.

The production build copies `public/` and `.next/static/` into the standalone bundle; CI runs `scripts/smoke-standalone.mjs` to verify production HTML and CSS delivery. The browser-level smoke suite is `npx playwright test tests/e2e/design-system-visual.spec.ts`; it exercises shared buttons, inputs, toggles, tabs, dialogs, sheets, sound controls, auth validation, and captures the public showcase at 360, 768 and 1440 pixels in light, dark and high-contrast themes. Playwright always starts a fresh app on port 3100 and refuses remote database URLs so account-creating tests cannot reuse a running app connected to Supabase. Full E2E flows require a disposable local PostgreSQL database with the Prisma schema applied and the local private MinIO bucket available. See [docs/perf-after.md](./docs/perf-after.md) for measured results and current gaps; Lighthouse and route-level performance budgets are not yet enforced.

Read [SECURITY.md](./SECURITY.md) for the implemented controls, [ARCHITECTURE.md](./ARCHITECTURE.md) for the request flow, and [AGENTS.md](./AGENTS.md) for permanent project rules.

## Dashboard foundation

The authenticated dashboard is driven by `/api/v1/dashboard`, `/tasks`, `/days`, `/streak`, and `/xp`. All task writes require the requested `localDate` to equal the server's current date in the user's saved profile timezone. The task timer, day log, XP, gems, and streak are persisted in PostgreSQL. Configure `TASK_COMPLETION_FRACTION` (defaults to `0.25`) to tune the minimum fraction of a planned session required before completion.

The month calendar keeps past days read-only and future days locked. A completed day grants one chest that expires at midnight in the profile timezone; XP and gems are credited only when the chest is claimed. Streak freezes cost 200 XP and are applied lazily when the dashboard, calendar, or streak endpoint discovers a missed day.

## Game systems

The dashboard, pet companion, closet/shop, friends, weekly leagues, achievements, notifications, Story Corner memories, and sound/FOMO preferences are backed by PostgreSQL. Story records and attachment metadata are part of account export; account deletion attempts to remove both completed and pending private storage objects before deleting the account. Pet shop purchases use a serializable transaction, a conditional gem debit, and a unique user/item record. Leagues contain real members only and roll forward from each member’s prior league and rank. The “Reduce FOMO prompts” preference softens countdown copy and hides friend streak-warning prompts. Browser sound preferences are initialized only after a user gesture and are synchronized with account preferences. Settings also persist theme and reduced-motion preferences and provide profile/timezone updates, export, and password-confirmed account deletion.

Game APIs include `/api/v1/pets`, `/api/v1/pets/feed`, `/api/v1/shop`, `/api/v1/preferences`, `/api/v1/notifications`, `/api/v1/achievements`, `/api/v1/league`, `/api/v1/friends`, and `/api/v1/chest/claim`. The authenticated screens are `/shop`, `/league`, `/friends`, `/motivation` (personal board), and `/settings`. Account export includes game inventory, achievements, preferences, notifications, league history, and friend links.

## Story Corner and media uploads

`/story` lets each signed-in user save and search personal memories with a title, plain-text story, tags, date, mood, and either an uploaded image/video or an external URL. The feed supports tag, mood, date-range, and text filters with cursor-based loading, editing, deletion, and a keyboard/touch friendly lightbox. Saving a memory evaluates the Memory Maker achievement.

Uploads use a private S3-compatible bucket. The browser requests a short-lived presigned PUT URL from `/api/v1/uploads/presign`, uploads directly to MinIO/S3, then calls `/api/v1/uploads/confirm`. The server checks object size and declared MIME, sniffs file magic bytes, re-encodes images with Sharp to remove metadata (including EXIF/GPS), and creates a WebP thumbnail. Video poster frames are generated in the browser. Reads use ten-minute signed URLs; deletes remove the user's objects and thumbnails. Local MinIO CORS is configured by `docker/minio-cors.json`.

External media URLs are stored without server-side fetching. Only YouTube and Vimeo URLs become sandboxed embeds. HTTPS raster image links can be displayed as images with `referrerpolicy=no-referrer`; other URLs render as links. Non-HTTP(S), credential-bearing, localhost, and private-network destinations are rejected. The upload MIME allowlist is JPEG, PNG, WebP, GIF (up to 10 MB), and MP4/WebM (up to 100 MB).

## Material Library

`/materials` stores rich-text notes, documents, images, useful links, and videos. Notes are sanitized with DOMPurify on both client and server, and new notes keep a local autosave draft until saved. Materials can be sorted, searched across title/content/tags, filtered by type/tag/favourite/folder, pinned, and saved to nested subjects. Grid, list, and week/month timeline views share the same cursor-paginated API. Account export includes folders, material metadata, and file metadata.

Material file uploads reuse `/api/v1/uploads/confirm` and the private S3 pipeline, with a separate `/api/v1/materials/uploads/presign` policy allowing PDF, DOCX, PPTX, TXT, JPEG, PNG, WebP, GIF, and MP4 up to 25 MB. Office documents are checked for their expected archive content, PDFs for their header, text for valid UTF-8, and images are re-encoded and thumbnailed. YouTube and Vimeo URLs can be embedded as videos; all link/video URLs are stored without any server-side request. `/api/v1/materials` and `/api/v1/folders` expose the authenticated CRUD APIs with owner checks.

## Friends and collaboration

Friend codes are Crockford-base32 and can be copied, shared as a link, or scanned from the Friends page QR code. Invite lookups always return the same response for eligible and unavailable codes and are limited to 10 per hour per user. Invites are accepted, declined, or canceled explicitly. Friend APIs include block/unblock, remove, poke, duo streaks, sharing privacy, weekly XP leaderboard, recent shared activity, and shared study goals. Duo streaks require both users' daily logs to be complete for their own timezone-local day. Pokes are limited to one per pair per six hours, and recipients who reduce FOMO prompts do not receive poke notifications. Memories are never included in friend activity.

## Weekly reports

The `/report` dashboard builds a Monday–Sunday report using the account timezone. The report API lazily saves per-user snapshots to `WeeklyReport`; old weeks are generated on first view. It includes task completion, focus time, XP and levels, categories, memories, materials, mood, earned badges, opt-in friend XP and duo streak status. Charts include accessible data tables, and the download image includes no email or contact details. Vercel runs `/api/v1/cron/weekly-reports` each Monday and `/api/v1/cron/missed-days` daily. Both endpoints require `Authorization: Bearer $CRON_SECRET`; legacy `REPORT_CRON_SECRET` is accepted for compatibility.

## Motivation Corner

`/motivation` is a personal cork or pastel board for sticky notes and themed papers. Note geometry is stored as board-relative percentages, clamped by the server, and saved with optimistic debouncing. Keyboard users can focus each item and reposition it with arrow keys, or switch to an accessible list view. Paper images reuse the private upload pipeline through `/api/v1/motivation/uploads/presign` and `/api/v1/uploads/confirm`; only owned image files can be attached and unused objects are removed when their last note is deleted. A curated original quote list powers the daily quote card and saved favorites. Board writes are limited per account and each account can keep up to 100 items.

## Operations and quality checks

`Dockerfile` builds a standalone production image and checks `/api/health` for database readiness. See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel + Neon/Supabase + R2, VPS Compose operations, required environment variables, cron configuration, and backup guidance. CI runs dependency audit, lint, typecheck, unit/integration tests, production build, and Playwright E2E. Database-backed suites require PostgreSQL; upload E2E additionally requires a working private S3-compatible bucket.
