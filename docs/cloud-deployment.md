# PlacePrep Cloud Deployment

## Frontend

- Deploy the React app on Vercel.
- Set `VITE_API_URL=https://your-backend-domain/api`.
- Optionally set `VITE_API_FALLBACK_URLS` to comma-separated backup API origins for faster diagnosis if the primary URL stops resolving.

## Backend

- Deploy the Node.js API from `server/` on Render or Railway.
- Public signup is enabled by default. Set `INVITE_ONLY_ACCESS=true` only if you need to temporarily close free registration.
- Set `CLIENT_URLS` to the deployed frontend origin.
- Set `APP_URL` to the public frontend URL used in invite links.
- `OWNER_EMAILS` defaults to `mohanavelan2006@gmail.com`; any matching account is promoted to admin with full college-tier access during signup, login/profile reads, and startup schema sync.
- Keep `SMTP_FORCE_IPV4=true` on hosts that do not route IPv6; Gmail SMTP can otherwise resolve to IPv6 and fail before delivery starts.

## Database

- Use managed PostgreSQL such as Supabase Postgres.
- Point `DATABASE_URL` at the managed database.

## Storage

- Configure Cloudinary to store images, resumes, and APK uploads.
- Without Cloudinary, the API falls back to local storage and is not suitable for multi-instance production.

## Invite Access

- Use `BOOTSTRAP_ADMIN_INVITE_CODE` and `BOOTSTRAP_USER_INVITE_CODE` if you want one fixed admin invite and one fixed user invite at startup. `BOOTSTRAP_INVITE_CODE` remains as a legacy single-code fallback.
- Admin users can generate additional invites from Settings.

## Android

- Build the Android app from `/android`.
- Upload the generated `app-release.apk` from the admin Android panel in Settings.
