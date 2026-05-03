# PlacePrep Supabase Backend Migration

## Goal

Move backend execution off Railway and onto Supabase while keeping:

- frontend on Vercel
- database on Supabase Postgres
- uploads on Cloudinary

## Important platform shift

This is not a lift-and-shift deployment of the existing Express app.

The current backend is a Node + Express server in [server/src/app.js](/D:/New%20folder/placement-powerhouse-main/placement-powerhouse-main/server/src/app.js), but Supabase backend compute is based on Edge Functions. That means the migration is a rewrite of runtime shape, not just a host swap.

## Current backend surface

The current Express API exposes these route groups:

- `auth`
- `invites`
- `tasks`
- `logs`
- `power-pocket`
- `progress`
- `profile`
- `notifications`
- `apk`
- `uploads`
- `resume`
- `ai`
- `assessments`
- `coach`

It also runs a scheduler for notifications and email delivery.

## Supabase target shape

- `supabase/functions/api`
  A single routed Edge Function that will gradually absorb the HTTP API.
- `supabase/functions/notification-digest`
  A scheduled function target for morning and evening reminder delivery.

## Key migration constraints

- Supabase Edge Functions are Deno-based serverless functions, not long-running Node servers.
- Outgoing SMTP ports `25` and `587` are not allowed on Supabase Edge Functions.
- The current Nodemailer SMTP flow must be replaced with an HTTP email provider such as Resend.
- Scheduled jobs should move from in-process Node cron to `pg_cron` + `pg_net` invoking Edge Functions.

## Recommended migration order

1. Keep Vercel frontend unchanged.
2. Deploy `api` and `notification-digest` functions in Supabase.
3. Port health, auth, and notifications first.
4. Replace SMTP with Resend.
5. Port tasks, logs, profile, and progress routes.
6. Port assessments and AI routes.
7. Switch `VITE_API_URL` to the Supabase function base.
8. Retire Railway after parity testing.

## Frontend target base URL

When the routed API function is ready, the Vercel frontend should point at:

```text
https://<project-ref>.supabase.co/functions/v1/api
```

## Secrets to store in Supabase

- `APP_URL`
- `CLIENT_URL`
- `CLIENT_URLS`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `NOTIFICATION_CRON_SECRET`
