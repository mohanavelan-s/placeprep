# PlacePrep Architecture Assessment: OAuth + MCP + MCP Apps

## A. Current Architecture

PlacePrep is a full-stack, cloud-deployed AI-powered placement preparation platform.

- **Frontend**: React 18, TypeScript, Vite 5, Tailwind CSS, Radix UI primitives, React Router DOM v6, TanStack React Query v5. Deployed on **Vercel** (`placeprep.vercel.app`), configured with rewrites in `vercel.json` routing `/api/(.*)` to the production Railway backend (`https://placeprep-api-production-851e.up.railway.app/api/$1`).
- **Backend**: Node.js and Express 4 deployed on **Railway** (`server/`). Entrypoint `src/index.js` bootstraps the Express app `src/app.js`, mounts API routes, runs database connection testing, and starts notification schedulers.
- **Database**: PostgreSQL hosted on **Supabase** (`nwjstaqudwpinfvmkcpp`). Connection pooling via `pg.Pool` (`server/src/config/database.js`). Database schema is managed via `server/src/db/schema.sql` and synchronized on startup if `AUTO_INIT_DB=true`. Supabase Row-Level Security (RLS) policies are active on public tables (`docs/supabase-rls-policies.sql`).
- **Media & File Storage**: Cloudinary is integrated for avatars, work-proof images, and resumes (`server/src/config/cloudinary.js`), with local disk fallback in `uploads/`.
- **Billing**: Razorpay payment gateway integration for Pro and College tiers (`server/src/routes/billing.routes.js`, `razorpay.routes.js`).
- **AI Integration**: OpenRouter / OpenAI SDK client with automated model fallback chain (`server/src/config/openai.js`).
- **Sandbox Execution**: Judge0 API integration for coding lab problem execution (`server/src/services/judge0.service.js`).

---

## B. Current Authentication & User Model

- **Identity Provider**: Local username/email + bcrypt password authentication (`users` table).
- **Session Mechanism**: On successful login (`POST /api/auth/login`), `auth.service.js` generates an **HS256 JWT** via `signAccessToken()` in `server/src/utils/jwt.js`.
  - Claims: `{ sub: user.id, email: user.email, username: user.username, role: user.role, accessTier: user.accessTier }`.
  - Expires in: `7d` (configured by `JWT_EXPIRES_IN`).
  - Secret: `JWT_SECRET`.
- **Frontend Storage**: The token is stored in the browser `window.localStorage` under key `placeprep.token` (`src/lib/api.ts`). The user object is cached under `placeprep.user`.
- **Backend Verification**: `server/src/middleware/auth.js` (`requireAuth`) extracts `Authorization: Bearer <token>`, verifies the signature using `jwt.verify(token, env.jwtSecret)`, and loads the active user from PostgreSQL using `userRepository.findById(payload.sub)`. Sets `req.user = user`.
- **Critical Architectural Boundary**:
  - The browser session JWT is an internal application token and MUST NOT be accepted at `/mcp`.
  - External AI hosts (ChatGPT, Claude, etc.) must NEVER receive user credentials or direct application JWTs.
  - Instead, PlacePrep must act as an **OAuth 2.1 Authorization Server**, issuing scoped, resource-bound, asymmetric or cryptographically verified access tokens via Authorization Code + PKCE (S256).

---

## C. Existing Backend APIs and Domain Services

The backend follows a layered architectural pattern:
`Routes -> Middleware -> Controllers -> Domain Services -> Repositories -> Database (pg)`.

Domain services consistently accept the authenticated `user` object as their first parameter, and repositories strictly scope SQL queries with `WHERE user_id = $1` or `WHERE id = $1 AND user_id = $2`:

1. **`task.service.js`**:
   - `listTasks(user, filters)`: Lists tasks with optional date (`today` or `YYYY-MM-DD`), status, and category filters. Auto-verifies LeetCode tasks and ensures today's active prep plan tasks.
   - `getTask(user, taskId)`: Retrieves a specific task, enforcing that `task.user_id === user.id`.
   - `createTask(user, payload)`: Creates a new placement prep task (DSA, Core, Project, Aptitude, Resume, MockInterview, Other) with timezone normalization and progress sync.
   - `updateTask(user, taskId, updates)`: Updates status (`pending`, `in_progress`, `completed`, `skipped`), dates, and completion timestamp.
   - `deleteTask(user, taskId)`: Explicitly deletes a task owned by `user.id`.
2. **`progress.service.js`**:
   - `getSummary(user)`: Calculates student placement readiness score (0-100), consistency score, solved problem count, streak, topic strength breakdown (DSA, Core, Project), and AI coach command.
   - `getCoachProfile(user)`: Retrieves coaching insights and focus areas.
3. **`auth.service.js` & `userProfile.service.js`**:
   - `getProfile(userId)`: User metadata, target role, placement date, weak areas, strong topics.
   - `userProfile.service.getProfile(user)`: Social profiles (LeetCode, GitHub, LinkedIn), notification preferences.
4. **`powerPocket.service.js`**:
   - `startSession(user, payload)`: Starts a timed focus/study sprint linked to a task.
   - `endSession(user, sessionId, payload)`: Ends the session, updates duration and status.

All of these domain services can be safely reused by the MCP layer without modifying existing business logic or bypassing database security.

---

## D. Recommended MCP Placement

**Placement**: Directly inside the existing Express backend (`server/`).
**Endpoint**: `POST /mcp` (Streamable HTTP transport per MCP 2026 specification).

**Rationale**:
1. **Zero Second Backend**: Extends the single source of truth rather than creating a separate service.
2. **Direct Service Reuse**: In-process calls to `task.service`, `progress.service`, and `userProfile.service` preserve exact tenant isolation, transaction safety, and cache invalidation.
3. **Single Origin & Deployment**: Railway deploys `server/` with HTTPS, environment variables, and PostgreSQL connectivity already provisioned.
4. **Standard MCP SDK Compatibility**: `@modelcontextprotocol/server`, `@modelcontextprotocol/node`, and `@modelcontextprotocol/ext-apps` are already installed in `server/package.json`.

---

## E. Recommended OAuth Placement

**Placement**: Root-level routes in the existing Express backend (`server/src/routes/mcp.routes.js`).

**OAuth Authority Model**:
- **Discovery**:
  - `GET /.well-known/oauth-protected-resource`
  - `GET /.well-known/oauth-protected-resource/mcp`
  - `GET /.well-known/oauth-authorization-server`
  - `GET /.well-known/openid-configuration`
- **Authorization & Token Lifecycle**:
  - `GET /oauth/authorize` (Initiates server-side authorization transaction, prompts for login/consent)
  - `POST /oauth/consent` (Authenticates user, verifies approval, issues single-use auth code)
  - `POST /oauth/token` (Validates PKCE `code_verifier` with S256, exchanges code for access token)
  - `POST /oauth/revoke` (Revokes access tokens)
  - `GET /oauth/jwks` (Exposes RS256 public keys for client/resource verification)

**Client Registration Strategy**:
- Smallest standards-compliant approach: Predefined client registry configured via `OAUTH_CLIENTS` (JSON array with `clientId` and exact `redirectUris`).
- Dynamic Client Registration (DCR) is not advertised by default, preventing unauthenticated client table bloat while ensuring complete compatibility with predefined AI connectors (Claude, ChatGPT, reference hosts).

---

## F. MCP Tool Candidates

Tools are designed as model-facing routing APIs, distinguishing read, setup/review, and narrow mutations:

1. `get_profile` (Read):
   - Description: "Retrieve the authenticated student's placement preparation profile, target role, placement target date, readiness score, current streak, weak areas, and strong topics."
   - Required scopes: `placeprep.profile.read`.
2. `get_progress_summary` (Read):
   - Description: "Retrieve the student's placement preparation analytics, including topic strengths (DSA, Core, Project), consistency score, failed attempts, and the AI coach directive."
   - Required scopes: `placeprep.progress.read`.
3. `get_tasks` (Read):
   - Description: "List placement preparation tasks for the authenticated student with optional filtering by date ('today' or YYYY-MM-DD), status ('pending', 'in_progress', 'completed'), and category ('DSA', 'Core', 'Project', 'Aptitude', 'Resume', 'MockInterview')."
   - Required scopes: `placeprep.tasks.read`.
4. `get_task` (Read):
   - Description: "Retrieve full details of a specific placement preparation task owned by the authenticated student by its task ID."
   - Required scopes: `placeprep.tasks.read`.
5. `task_setup` (Setup / Propose - UI Enhanced):
   - Description: "Interactive setup and review tool for drafting a placement preparation task. Collects and validates title, category, difficulty (1-5), estimated minutes, priority, and scheduled date before persistence. Enriched with interactive UI when supported."
   - Required scopes: `placeprep.tasks.read`.
   - UI Resource: `ui://widget/task-setup.html`.
6. `create_task` (Mutation - Narrow & Validated):
   - Description: "Persist a confirmed placement preparation task for the authenticated student after user review. Requires exact title and category. Never uses synthetic placeholders."
   - Required scopes: `placeprep.tasks.write`.
7. `update_task_status` (Mutation - Narrow):
   - Description: "Update the status ('pending', 'in_progress', 'completed', 'skipped') of an existing preparation task owned by the authenticated student. Automatically updates progress stats."
   - Required scopes: `placeprep.tasks.write`.
8. `delete_task` (Destructive - Explicit):
   - Description: "Permanently delete a preparation task owned by the authenticated student. Verifies ownership and updates progress metrics."
   - Required scopes: `placeprep.tasks.write`.
9. `prep_dashboard_view` (Read / Setup - UI Enhanced):
   - Description: "Interactive view of today's placement preparation plan and progress. Displays today's task checklist, current streak, readiness score, and quick status toggles."
   - Required scopes: `placeprep.tasks.read`.
   - UI Resource: `ui://widget/prep-dashboard.html`.

---

## G. MCP App Candidates (using `@modelcontextprotocol/ext-apps`)

1. **Task Setup & Review App** (`ui://widget/task-setup.html`):
   - Interactive form to configure, preview, and adjust preparation tasks (title, category badge, difficulty slider 1-5, estimated duration, priority selection).
   - "Save Task" action calls `create_task` through the official App bridge (`app.callServerTool`).
   - Graceful non-UI fallback: tool returns structured JSON representation of the configured task.
2. **Prep Dashboard & Quick Tracker App** (`ui://widget/prep-dashboard.html`):
   - Interactive widget showing student stats (streak badge, readiness ring), today's task checklist with live status checkboxes, and coach advice.
   - Interactive toggles call `update_task_status` through the bridge.
   - Graceful non-UI fallback: tool returns markdown and JSON summary of today's schedule and metrics.

Both apps adhere to:
- Sandboxed iframe execution.
- Host theme CSS variable adaptation (`applyHostStyleVariables`, `getDocumentTheme`).
- Responsive dynamic resizing via `autoResize: true` / `SIZE_CHANGED_METHOD`.
- Official `App` and `PostMessageTransport` protocol implementation.

---

## H. Database Changes

The schema in `server/src/db/schema.sql` contains the foundational OAuth tables:
1. `oauth_authorization_transactions`: Stores client ID, redirect URI, requested scopes, resource, PKCE `code_challenge`, external client state, status (`pending_authentication`, `pending_consent`, `code_issued`, `rejected`), and expiration.
2. `oauth_authorization_codes`: Stores transaction reference, SHA-256 hashed single-use authorization code, user ID, client ID, redirect URI, resource, scopes, and expiration.
3. `oauth_access_tokens`: Stores SHA-256 hashed token or token ID, user ID, client ID, resource, scopes, expiration, and revocation timestamp.

To support asymmetric signing (RS256) and refresh tokens:
- Add `refresh_token_hash`, `refresh_expires_at` to `oauth_access_tokens` (or dedicated `oauth_refresh_tokens` table).
- Indices on `expires_at` and `token_hash` are already configured.

---

## I. Required Environment Variables

Add to `server/.env.example` and production Railway config:
- `MCP_PUBLIC_URL`: Base public URL for the MCP server (e.g. `https://placeprep-api-production-851e.up.railway.app`).
- `OAUTH_ISSUER`: Base issuer URL for OAuth discovery (e.g. `https://placeprep-api-production-851e.up.railway.app`).
- `OAUTH_RESOURCE`: Canonical protected resource URL (e.g. `https://placeprep-api-production-851e.up.railway.app/mcp`).
- `OAUTH_CLIENTS`: JSON string of registered client configurations with exact redirect URIs.
- `OAUTH_KEY_ID`: Identifier for the active JWKS key (default `placeprep-oauth-key-1`).
- `OAUTH_PRIVATE_KEY_PEM`: RSA private key (PEM format) for production asymmetric token signing. (Development falls back to an automatically generated RSA keypair if unset).

---

## J. Implementation Plan

- **Phase 1**: MCP server skeleton with Streamable HTTP transport and strict 401 OAuth challenge.
- **Phase 2**: Connect MCP to existing PlacePrep backend/service layer (`task.service`, `progress.service`, `userProfile.service`).
- **Phase 3**: Implement authenticated MCP request handler with context derivation (`req.mcpPrincipal`).
- **Phase 4**: Complete standards-compliant OAuth discovery (`.well-known/oauth-protected-resource`, `.well-known/oauth-authorization-server`, `.well-known/openid-configuration`).
- **Phase 5**: Complete Authorization Code + PKCE S256 flow with server-side transactions and branded consent screen.
- **Phase 6**: Asymmetric RS256 token issuance, JWKS endpoint (`/oauth/jwks`), token verification, resource binding, and scope enforcement.
- **Phase 7**: Implement full set of PlacePrep MCP tools with strong Zod v4 schemas, LLM-optimized routing descriptions, and ownership enforcement.
- **Phase 8**: Implement interactive MCP Apps using `@modelcontextprotocol/ext-apps` (`registerAppTool`, `registerAppResource`, `App`, `PostMessageTransport`).
- **Phase 9**: Reference host and bridge verification tests.
- **Phase 10**: Comprehensive unit and integration test suite (PKCE, single-use codes, replay attacks, resource mismatch, cross-user isolation, scopes).
- **Phase 11**: Real client integration test guide.
- **Phase 12**: Deployment configuration and verification.
- **Phase 13**: Complete technical documentation in `docs/mcp/`.
