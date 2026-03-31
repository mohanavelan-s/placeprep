# PlacePrep

Live deployment:

- Web app: [https://placeprep-nine.vercel.app/](https://placeprep-nine.vercel.app/)
- Backend health: [https://placeprep-api-production.up.railway.app/api/health](https://placeprep-api-production.up.railway.app/api/health)

PlacePrep now includes a modular Express + PostgreSQL backend inside [server/package.json](/D:/New%20folder/placement-powerhouse-main/placement-powerhouse-main/server/package.json) with JWT auth, task/log tracking, Power Pocket sessions, AI utilities, uploads, and progress analytics.

Backend quick start:

1. Create `server/.env` from [server/.env.example](/D:/New%20folder/placement-powerhouse-main/placement-powerhouse-main/server/.env.example).
2. Install dependencies with `npm install` inside `server`.
3. Run `npm run db:init` or let startup auto-initialize the schema.
4. Optionally seed demo data with `npm run db:seed`.
5. Start the API with `npm run dev` or `npm start`.

Key API groups:

- `/api/auth`
- `/api/tasks`
- `/api/logs`
- `/api/power-pocket`
- `/api/progress`
- `/api/uploads/images`
- `/api/resume`
- `/api/ai`
