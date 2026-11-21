# Deployment

HabitHop supports a managed deployment on Vercel with Neon or Supabase PostgreSQL and Cloudflare R2, or a single VPS using Docker Compose. Use Node.js 20.9+ for build tooling (the production image uses Node 22). Keep PostgreSQL and object storage private, use HTTPS, and configure a shared rate-limit adapter before operating more than one app instance.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection URL. Use a pooled URL for serverless requests and a direct URL for Prisma schema operations where the provider offers both. |
| `DIRECT_URL` | Yes for Prisma CLI/schema operations | Direct or session-mode PostgreSQL URL. Prisma Client uses `DATABASE_URL`; Prisma CLI uses this direct URL for schema operations. |
| `JWT_SECRET` | Yes | Random secret, at least 32 characters. Rotating it invalidates access tokens; revoke active sessions as part of rotation. |
| `S3_ENDPOINT` | Yes | S3-compatible API origin (R2 endpoint or private MinIO endpoint). |
| `S3_ACCESS_KEY` | Yes | Restricted bucket credentials. |
| `S3_SECRET_KEY` | Yes | Restricted bucket secret. |
| `S3_BUCKET` | Yes | Private bucket name. |
| `NEXT_PUBLIC_APP_URL` | Yes in production | Canonical HTTPS app origin used for links and callback/origin checks. |
| `NODE_ENV` | Set by host | `production` in deployed runtime. |
| `TASK_COMPLETION_FRACTION` | No | Minimum planned-session fraction, default `0.25`, range `0.05`–`1`. |
| `CRON_SECRET` | Yes for scheduled jobs | Random secret, at least 32 characters. Vercel sends it as the `Authorization: Bearer` value when configured as `CRON_SECRET`; legacy `REPORT_CRON_SECRET` is also accepted. |

Copy `.env.example` for local Compose development. The example credentials are only for a local machine and must never be reused in production.

## Vercel + Neon/Supabase + Cloudflare R2

1. Create a Supabase PostgreSQL database and set `DATABASE_URL` to its transaction-pooler URL for application queries. Set `DIRECT_URL` to its session-pooler or direct connection for Prisma migrations. Do not expose either URL to the browser.
2. Create a private R2 bucket and scoped API credentials. Set `S3_ENDPOINT` to the account's S3 API endpoint and fill the access key, secret, and bucket variables. Configure bucket CORS for the deployed app origin and browser `PUT` requests with the required content-type headers.
3. Add all environment variables in Vercel for Preview and Production, with separate database/storage credentials where possible. Set `NEXT_PUBLIC_APP_URL` to the deployed HTTPS origin and set `CRON_SECRET` to a random value.
4. Run `npm run db:migrate:deploy` once from a trusted release job before deploying the app. The existing Supabase schema is baselined in `prisma/migrations`; do not use `prisma db push` against shared or production databases, and do not run migrations from every web instance.
5. `vercel.json` schedules the weekly report at 00:15 UTC Monday and the lazy missed-day sweep at 00:05 UTC daily. Both routes validate the bearer secret. Missed-day reconciliation remains timezone-aware and is also performed on dashboard/calendar/streak reads, so a delayed cron does not alter the local-day rule.

## VPS + Docker Compose

The included Compose file is intended for local development and supplies PostgreSQL and MinIO. For production, run the app image from `Dockerfile` and point it at managed/private PostgreSQL and S3 storage. A single-host deployment may use Compose for the app, PostgreSQL, and MinIO, but must replace all sample credentials, bind database/storage ports to a private network, configure TLS at a reverse proxy, and protect persistent volumes. Build with `docker build -t habithop .`; run `npm run db:migrate:deploy` once from the release environment before rolling out the image. The container exposes `/api/health`, which returns 200 only when PostgreSQL can answer a query; Docker's healthcheck uses that endpoint.

For cron on a VPS, invoke these authenticated GET endpoints on a scheduler and add `Authorization: Bearer <CRON_SECRET>`:

- `GET /api/v1/cron/weekly-reports` every Monday (UTC).
- `GET /api/v1/cron/missed-days` daily. It checks each profile in their own timezone and lazily records missed dates / consumes eligible freezes.

Use a scheduler that reads secrets from a protected file or secret manager, not a shell command stored in a shared crontab. Monitor failed cron responses and health checks.

## Backups and recovery

- Enable automated PostgreSQL snapshots and point-in-time recovery where available. Test restoration to a separate database regularly.
- Back up the private object bucket independently; database snapshots alone do not contain uploaded media. Keep object versioning or a provider backup policy where practical.
- Preserve `JWT_SECRET`, `CRON_SECRET`, S3 credentials, and database credentials in a secret manager. Have a rotation/revocation procedure and never include `.env` files in backups accessible to the web root.
- Restore PostgreSQL and bucket data as one recovery point. Verify ownership metadata, signed reads, and cron behavior before reopening traffic.

## Query/index review

The schema has composite indexes for dashboard task/date scans, user day logs, report week lookups, friendship direction, material filters, board ordering, and notification feeds. When production query plans are available, review the highest-volume queries with `EXPLAIN (ANALYZE, BUFFERS)` using representative data, especially task/day-log calendar reads, material search/filtering, friend activity, and report source aggregation. No production database was available during this quality pass, so no live query plan is claimed here.
