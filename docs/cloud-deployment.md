# PlacePrep Cloud Deployment

## Frontend

- Deploy the React app on Vercel.
- Set `VITE_API_URL=https://your-backend-domain/api`.

## Backend

- Deploy the Node.js API from `server/` on Render or Railway.
- Set `ALLOW_PUBLIC_SIGNUP=false`.
- Set `CLIENT_URLS` to the deployed frontend origin.
- Set `APP_URL` to the public frontend URL used in invite links.

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
