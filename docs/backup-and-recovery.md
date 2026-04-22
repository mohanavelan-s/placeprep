# PlacePrep Backup And Recovery

## Hosting fallback

- Frontend: the repo is now ready for Netlify with [netlify.toml](/D:/New%20folder/placement-powerhouse-main/placement-powerhouse-main/netlify.toml). That gives you a second static-host option besides Vercel.
- Backend: keep using Railway or Render for the API. [render.yaml](/D:/New%20folder/placement-powerhouse-main/placement-powerhouse-main/render.yaml) is already wired for the backend service.

## What to back up

- Frontend and backend code: back up the Git repo regularly.
- Database: back up PostgreSQL with `pg_dump` and keep point-in-time backups enabled on the managed provider.
- Cloudinary assets: export a resource manifest regularly and keep the original uploaded files in a second storage location if you need full disaster recovery.
- Environment variables: store a secure copy outside the deployment platform.

## Backup script

Run this from the repo root:

```powershell
.\scripts\backup-placeprep.ps1 -IncludeDbDump -IncludeCloudinaryManifest
```

What it does:

- creates a zip of the committed Git `HEAD`
- creates a second zip of the current working copy so local uncommitted changes are not missed
- auto-loads `server/.env` when present so `DATABASE_URL` and Cloudinary credentials do not need to be pre-exported
- optionally copies live env files into the backup folder when you add `-IncludeEnvFiles`
- optionally dumps PostgreSQL when `DATABASE_URL` is available and `pg_dump` is installed
- optionally exports a Cloudinary asset manifest when Cloudinary credentials are available
- writes a backup manifest JSON alongside the artifacts

If you want a backup that also includes your current env files:

```powershell
.\scripts\backup-placeprep.ps1 -IncludeDbDump -IncludeEnvFiles
```

## Environment validation

Before a redeploy or host migration, run:

```powershell
.\scripts\check-placeprep-env.ps1
```

What it checks:

- frontend `VITE_API_URL`
- backend core values such as `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URLS`, and `APP_URL`
- optional but important services such as SMTP, web push, OpenAI, and Cloudinary
- migration warnings when values still point at `vercel.app`

## Recommended production setup

- Frontend: Netlify or Cloudflare Pages
- Backend: Railway or Render
- Database: managed PostgreSQL with automated backups enabled
- Assets: Cloudinary plus a scheduled manifest export and a second cold-storage archive for critical files

## Recovery order

1. Restore environment variables.
2. Restore PostgreSQL from the latest verified dump or managed backup.
3. Redeploy the backend.
4. Redeploy the frontend.
5. Reconnect Cloudinary or restore assets from the secondary archive.
