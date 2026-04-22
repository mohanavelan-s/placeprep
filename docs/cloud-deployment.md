# PlacePrep Cloud Deployment

## Frontend

- Primary backup path: deploy the React app on Netlify with [netlify.toml](/D:/New%20folder/placement-powerhouse-main/placement-powerhouse-main/netlify.toml).
- Set `VITE_API_URL=https://your-backend-domain/api`.
- After migration, update backend `CLIENT_URLS` and `APP_URL` to the new frontend origin.

## Backend

- Deploy the Node.js API from `server/` on Render or Railway.
- Set `ALLOW_PUBLIC_SIGNUP=false`.
- Set `CLIENT_URLS` to the deployed frontend origin.
- Set `APP_URL` to the public frontend URL used in invite links.
- [render.yaml](/D:/New%20folder/placement-powerhouse-main/placement-powerhouse-main/render.yaml) is already prepared for the backend service.

## Database

- Use managed PostgreSQL such as Supabase Postgres.
- Point `DATABASE_URL` at the managed database.
- Before changing hosts, take a logical dump with `.\scripts\backup-placeprep.ps1 -IncludeDbDump`.
- If you move away from the current database provider later, restore the dump first and then update `DATABASE_URL`.

## Storage

- Configure Cloudinary to store images, resumes, and APK uploads.
- Without Cloudinary, the API falls back to local storage and is not suitable for multi-instance production.

## Invite Access

- Use `BOOTSTRAP_ADMIN_INVITE_CODE` and `BOOTSTRAP_USER_INVITE_CODE` if you want one fixed admin invite and one fixed user invite at startup. `BOOTSTRAP_INVITE_CODE` remains as a legacy single-code fallback.
- Admin users can generate additional invites from Settings.

## Android

- Build the Android app from `/android`.
- Upload the generated `app-release.apk` from the admin Android panel in Settings.

## Post-migration checks

1. Run `.\scripts\check-placeprep-env.ps1`.
2. Open `/api/health` on the new backend.
3. Sign in on the new frontend.
4. Trigger browser notifications from Settings.
5. Trigger a notification sync with email delivery enabled and confirm the message arrives.
