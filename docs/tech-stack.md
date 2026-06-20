# PlacePrep Tech Stack

## Overview

PlacePrep is a full-stack, cloud-deployed, AI-powered placement preparation platform with:

- Web frontend
- Backend API
- PostgreSQL database
- Cloud storage
- Email and browser notifications
- Android mobile app

## Frontend

- React 18
- TypeScript
- Vite 5
- React Router DOM
- TanStack React Query
- Tailwind CSS
- Radix UI primitives
- shadcn-style component architecture
- Framer Motion
- React Hook Form
- Zod
- Recharts
- React Markdown

## Backend

- Node.js
- Express 4
- PostgreSQL via `pg`
- bcryptjs
- jsonwebtoken
- express-validator
- express-rate-limit
- Helmet
- CORS
- Morgan
- Multer
- Nodemailer
- node-cron

## Database

- PostgreSQL
- Supabase-hosted production database
- SQL schema managed in `server/src/db/schema.sql`

### Core tables

- `users`
- `invites`
- `tasks`
- `daily_logs`
- `power_pocket_sessions`
- `progress_stats`
- `images`
- `resumes`
- `user_profiles`
- `notifications`
- `prep_plans`
- `mentor_messages`
- `apk_versions`

## AI

- OpenAI Node SDK
- OpenRouter as the active provider path
- Fallback logic for AI outages or quota issues

### AI-powered features

- Task generation
- Prep Architect roadmap generation
- Stuck-help guidance
- Daily evaluation
- Nocturne Mentor chat
- Quick task generation for Power Pocket

## Storage

- Cloudinary for production file storage

### Stored assets

- Profile images
- Proof-of-work screenshots
- Resume files
- Android APK files

## Notifications

- Email notifications through SMTP + Nodemailer
- Browser notifications through the Notification API
- Scheduled triggers using `node-cron`

## Security and Access

- JWT authentication
- bcrypt password hashing
- Invite-only registration in production
- Username or email login
- Role model: `admin` and `user`
- Protected backend routes
- Protected frontend routes
- Supabase Row-Level Security enabled on public tables
- Live RLS policy record documented in `docs/supabase-rls-policies.sql`

## Cloud Deployment

### Frontend

- Vercel

### Backend

- Railway

### Database

- Supabase PostgreSQL

### Storage

- Cloudinary

## Android App

- Kotlin
- Jetpack Compose
- Material 3
- Navigation Compose
- Retrofit
- OkHttp
- Gson Converter
- AndroidX Security Crypto
- Gradle 8.9 wrapper
- Java 17 target

## Live Architecture Summary

- Web app on Vercel
- API on Railway
- Database on Supabase
- Assets on Cloudinary
- AI through OpenRouter/OpenAI
- Email through SMTP
- Android app consuming the same backend API
