# Momentum — System Architecture

**Phase 2 of the Momentum documentation series.**

Phase 1 explained *what* Momentum is. This document explains *how it is built* — the surfaces, the layers, the data flows, and the architectural decisions that hold it together. It stops short of individual feature implementation, which is Phase 3 onward.

---

## 1. The Shape of the System

Momentum is a **three-surface distributed system** around a single stateless API and one database.

```
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│   WEB APPLICATION  │   │ BROWSER EXTENSION  │   │  CODING PLATFORMS  │
│   React SPA        │   │ Chrome MV3         │   │  LeetCode, CF, …   │
│   (Vercel)         │   │ (user's browser)   │   │  (third-party)     │
└─────────┬──────────┘   └─────────┬──────────┘   └─────────▲──────────┘
          │                        │                        │
          │  HTTPS / JSON          │  HTTPS / JSON          │ observes DOM
          │  Bearer JWT            │  Bearer JWT            │ (read-only)
          │                        │                        │
          └────────────┬───────────┘                        │
                       ▼                                    │
          ┌─────────────────────────────┐                   │
          │      REST API (Express)     │                   │
          │      stateless · Node 20    │        ┌──────────┴─────────┐
          │      (Render)               │        │  content scripts   │
          └─────────────┬───────────────┘        │  injected by the   │
                        │                        │  extension         │
        ┌───────────────┼───────────────┐        └────────────────────┘
        ▼               ▼               ▼
  ┌───────────┐  ┌─────────────┐  ┌──────────────────┐
  │  MongoDB  │  │ BACKGROUND  │  │ EXTERNAL SERVICES│
  │  Atlas    │  │ SCHEDULERS  │  │ GitHub API       │
  │           │  │ in-process  │  │ Groq LLM         │
  └───────────┘  └─────────────┘  │ Gmail SMTP       │
                                  └──────────────────┘
```

**The defining architectural property: the API is the only thing that touches the database.** The web app and the extension are independent clients of the same REST surface, authenticated the same way, with no privileged backdoor for either. The extension is not a plugin of the web app — it is a peer client that happens to run inside the browser.

---

## 2. Repository Structure

A single repository holds three deployable artifacts. The backend intentionally shares the **root `package.json`** rather than owning its own — this is why the backend Docker build and Render service both use the repository root as their build context.

```
MAIN/
├── package.json                 # backend dependencies + extension build scripts
├── docker-compose.yml           # local full-stack orchestration
├── .github/workflows/ci.yml     # CI: syntax check · build · docker build
│
├── backend/                     # Express REST API
│   ├── server.js                # process lifecycle: env → DB → schedulers → listen
│   ├── app.js                   # composition root: middleware + route mounting
│   ├── Dockerfile               # multi-stage; build context = repo root
│   ├── config/
│   │   ├── db.js                # Mongo connection + legacy index cleanup
│   │   └── env.js               # startup env validation (fail-fast in prod)
│   ├── middlewares/
│   │   ├── authMiddleware.js    # JWT verification → req.user
│   │   ├── errorMiddleware.js   # centralized error → HTTP mapping
│   │   └── rateLimiters.js      # 7 endpoint-scoped limiters
│   ├── utils/
│   │   ├── AppError.js          # operational-error marker
│   │   ├── crypto.js            # AES-256-GCM encrypt/decrypt
│   │   └── dateStats.js         # shared streak/date math
│   └── modules/                 # 11 domain modules
│       ├── auth/  github/  task/  activity/  workload/
│       ├── analytics/  assistant/  notes/  companies/
│       ├── user/  notifications/
│       └── …
│
├── frontend/                    # React 19 + Vite SPA
│   ├── Dockerfile               # build → nginx runtime
│   ├── nginx.conf               # SPA fallback + /api proxy (compose only)
│   ├── vercel.json              # SPA rewrite for Vercel
│   └── src/
│       ├── api/                 # one module per backend domain + client.js
│       ├── auth/                # AuthProvider, token utils, route guards
│       ├── hooks/               # 16 data hooks over useAsyncData
│       ├── components/          # shared UI + domain component folders
│       ├── pages/               # 16 screens
│       └── theme/
│
├── extension/                   # Chrome Manifest V3
│   ├── manifest.json
│   ├── background.js            # service worker: message router
│   ├── background/              # activityManager, activityQueue, logger
│   ├── content/                 # content-script.js (judges) · content.js (site)
│   ├── providers/               # 7 platform adapters
│   ├── auth/  storage/  messaging/  shared/  config/  popup/
│
├── scripts/build-extension.js   # dev→prod URL injection + packaging
└── docs/                        # this series
```

---

## 3. Backend Architecture

### 3.1 Layered module pattern

Every domain module follows the same four-layer separation. This uniformity is the backend's most valuable property — any module can be understood by anyone who has read one other module.

```
   HTTP request
        │
        ▼
┌──────────────────┐
│  *.routes.js     │  path → handler binding; attaches authMiddleware
│                  │  and any rate limiter for this domain
└────────┬─────────┘
         ▼
┌──────────────────┐
│  *.controller.js │  HTTP concerns ONLY — read req, shape res,
│                  │  forward errors to next(). No business rules.
└────────┬─────────┘
         ▼
┌──────────────────┐
│  *.service.js    │  all business logic; throws AppError.
│                  │  HTTP-agnostic and independently callable.
└────────┬─────────┘
         ▼
┌──────────────────┐
│  *.model.js      │  Mongoose schema, indexes, hooks, enums
└──────────────────┘
```

The payoff of keeping services HTTP-agnostic shows up in the Assistant: `context.service.js` calls `workloadService.computeWorkloadSummary()` and `analyticsService.computeAnalyticsSummary()` **directly as functions**, not over HTTP. One implementation of the workload rules serves both the REST endpoint and the LLM context builder, with no duplication and no internal network hop.

### 3.2 The composition root

`app.js` is deliberately thin and declarative — read it and you know the entire HTTP surface:

```
helmet  →  cors (env-driven allowlist)  →  express.json (1 MB cap)
   →  /api/health
   →  10 mounted domain routers
   →  404 handler
   →  errorMiddleware  (last, catches everything)
```

`server.js` owns the process, not the app — a separation that makes `app` importable for testing without binding a port:

```
validateEnv()      fail fast on bad config
   → connectDB()   refuse to serve without a database
   → startSyncScheduler()      background worker 1
   → startReminderScheduler()  background worker 2
   → app.listen()
   → SIGTERM/SIGINT → graceful shutdown (drain, close Mongo, exit)
```

### 3.3 Cross-cutting middleware

**Authentication.** `authMiddleware` verifies the Bearer JWT and attaches `req.user = { userId }`. It explicitly rejects a refresh token presented as an access token — the two are separate credential classes and must not be interchangeable. Protected routers apply it once with `router.use(authMiddleware)` rather than per-route, so a new endpoint cannot accidentally ship unauthenticated.

**Error handling.** One `errorMiddleware` maps every failure to an HTTP response, translating Mongoose `ValidationError` → 400, `CastError` → 400, duplicate-key `11000` → 409. Its most important rule is a security one: an error not deliberately thrown as an `AppError` has its message replaced with a generic string, so driver internals, collection names, and index details never reach a client. 5xx errors are logged server-side with full detail.

**Rate limiting.** Seven limiters scoped to what each endpoint actually costs — login (10/15min), registration (8/hr), refresh (30/15min), OAuth start (20/15min), assistant (15/10min, because it costs real LLM money), GitHub writes (20/15min), email change (5/hr). In production `trust proxy` is enabled so limits key on the real client IP rather than Render's proxy.

### 3.4 Tenant isolation

There is no organisation or team concept — **every record is owned by exactly one user**, and `userId` is a required, indexed field on every domain model. Services take `userId` as their first argument and scope every query with it. Ownership is enforced by including `userId` in the query filter itself rather than fetching a document and then checking it, which makes "forgot the ownership check" a much harder mistake to make.

---

## 4. Frontend Architecture

A React 18.3 SPA built with Vite and React Router 6, deliberately dependency-light: **`react`, `react-dom`, `react-router-dom`, `lucide-react`** and nothing else. No Redux, no React Query, no component library, no CSS framework runtime. Everything else is built in.

### 4.1 The four layers

```
  pages/         16 screens; composition and layout
      │
      ▼
  hooks/         15 domain hooks (useTasks, useWorkload, useAnalyticsSummary…)
      │          all built on one useAsyncData primitive
      ▼
  api/           one module per backend domain — the ONLY place
      │          endpoint paths are written
      ▼
  api/client.js  single fetch wrapper: base URL, auth header,
                 401→refresh→retry, error normalisation
```

**Every network call in the application funnels through `client.js`.** That single choke point is what makes cross-cutting behaviour possible: attaching the Bearer token, transparently refreshing an expired one and replaying the request, unwrapping the `{success, data}` envelope, and converting failures into a uniform `ApiError`. Because it is the only path, there is no component anywhere that can bypass auth handling by calling `fetch` directly.

**`useAsyncData`** is a ~50-line replacement for a data-fetching library, providing `{data, error, isLoading, isFetching, refetch}` with an `active` flag guarding against setting state after unmount. All fifteen domain hooks are thin wrappers over it, so every screen gets identical loading, error, and refetch semantics for free.

### 4.2 State management

State is scoped rather than centralised:

| Kind | Held by | Example |
|---|---|---|
| Session | `AuthProvider` (React Context) | token, user, auth status |
| Server data | Per-hook local state | tasks, activities, analytics |
| UI state | Component local state | modals, form fields |
| Preferences | Context + `localStorage` | theme |

There is no global store, and for a single-user app with clean domain boundaries there is little for one to do — screens do not share mutable server state, they each own their slice and refetch it. Mutations call the API and then `refetch()`, trading a small amount of network chatter for the guarantee that the UI never diverges from the server.

`AuthProvider` is the one genuinely global piece: it owns the token lifecycle, wires the API client's token provider / refresh handler / unauthorized handler at mount, proactively renews the access token ahead of expiry, and syncs across tabs via the `storage` event.

### 4.3 Routing and guards

```
/login  /register  /install  /auth/github/callback     ← public
    │
    └── <ProtectedRoute>          redirects to /login if unauthenticated
            └── <AppShell>        persistent nav + layout
                    ├── /overview       /tasks    /tasks/:id/workspace
                    ├── /calendar       /placements  /placements/:id
                    ├── /activity       /analytics   /assistant
                    └── /journal        /settings    /help
```

Authorisation is structural: protected screens are children of a guard route, so a new screen added inside `AppShell` is protected by construction. An `ErrorBoundary` wraps the tree so a render failure in one panel degrades that panel rather than blanking the app.

---

## 5. Extension Architecture

The most architecturally distinctive surface, because Manifest V3 imposes constraints the other two do not have: **the service worker is ephemeral and can be terminated at any moment.**

### 5.1 Component layout

```
┌──────────────────────────────────────────────────────────────┐
│                    SERVICE WORKER (background.js)            │
│  central message router · the only component that            │
│  talks to the Momentum API                                   │
│                                                              │
│  ├── activityManager  send · 401-refresh · dedup             │
│  ├── activityQueue    offline persistence (bounded)          │
│  ├── oauth            chrome.identity OAuth flow             │
│  ├── storage-service  chrome.storage.local wrapper           │
│  └── jwt / logger     decoding, diagnostics                  │
└──────────▲──────────────────────▲─────────────────▲──────────┘
           │ chrome.runtime       │                 │
           │ .sendMessage         │                 │
   ┌───────┴────────┐    ┌────────┴───────┐   ┌─────┴──────┐
   │ content-script │    │   content.js   │   │   popup    │
   │ on 7 judges    │    │ on Momentum    │   │  UI + auth │
   │ detects solves │    │ site: auth sync│   │            │
   └───────┬────────┘    └────────────────┘   └────────────┘
           │ uses
   ┌───────▼──────────────────────────────────┐
   │ providers/  — 7 platform adapters        │
   │ leetcode · codeforces · gfg · hackerrank │
   │ codechef · atcoder · interviewbit        │
   └──────────────────────────────────────────┘
```

### 5.2 Key decisions

**The adapter pattern for platforms.** Each judge announces success differently, so each gets an adapter exposing a uniform interface (`name`, `hostMatch`, `getProblemKey`, `detectSolve`, `extractProblemData`, `isSubmitElement`, and the optional `isSubmitShortcut`, `mutationLooksRelevant`, `extractTimerSeconds`). `content-script.js` contains the *strategy* — mutation observation, submit detection, debouncing, retry — and knows nothing site-specific. **Adding an eighth platform means adding one adapter file, not touching the engine.** See Phase 4 for the full contract.

**Two content scripts, two jobs.** `content-script.js` runs on the seven judges and detects solves. `content.js` runs only on the Momentum site at `document_start`, performs one-login auth sync, and publishes extension presence. Separate concerns, separate injection targets, separate failure modes.

**All network I/O lives in the service worker.** Content scripts never call the API; they message the worker. This centralises auth, retry, and queueing in one place, and keeps credentials out of pages the extension does not control.

**State lives in `chrome.storage.local`, not memory.** Because MV3 can terminate the worker at any time, anything that must survive — tokens, the offline queue, per-problem session start times, sync status — is persisted. In-memory structures are treated strictly as a fast path, never as the record.

**Presence detection is race-proof.** `content.js` sets a DOM attribute *synchronously* at `document_start`, and also answers a `MOMENTUM_PING` from the page. Because the React app and the content script can mount in either order, one-shot announcement alone would be a coin flip; the ping covers the case where the page arrives late.

**Orphaned contexts fail silently.** Reloading the extension tears down `chrome.runtime` in already-injected scripts. Every `chrome.*` entry point is guarded by a liveness check, so an orphaned script stops cleanly instead of throwing in a retry loop — and critically, `content.js` wraps the site's own `fetch`, so a dead context must degrade to a no-op rather than break the page it is a guest on.

---

## 6. Data Flow: Three Journeys

### 6.1 A standard authenticated read

```
Component → hook → api/*.js → client.js
      │                          │ attach Bearer token
      │                          ▼
      │                    Express: cors → json → router
      │                          │ authMiddleware → req.user.userId
      │                          ▼
      │                    controller → service (scoped by userId) → Mongoose
      │                          │
      │                          ▼  { success: true, data }
      └──────────────── client.js unwraps → hook state → render
```

If the API returns **401**, `client.js` intercepts it, calls the refresh handler, and replays the original request once. The component never learns that its token expired.

### 6.2 The automatic solve capture — the system's signature flow

```
[1] User submits on LeetCode; verdict turns Accepted
        │
[2] content-script.js — MutationObserver sees a relevant DOM change
        │  adapter.detectSolve() confirms; timer captured at submit time
        ▼
[3] chrome.runtime.sendMessage(PROBLEM_SOLVED)
        ▼
[4] Service worker — activityManager
        │  in-memory + persisted dedup check
        │  attach access token (refresh on 401 and retry once)
        ▼
[5] POST /api/dsa/activity          ── network failure? → activityQueue,
        │                              retried later; nothing is lost
        ▼
[6] authMiddleware → dsa-activity.controller
        │  server-side duplicate check (independent of client dedup)
        ▼
[7] Activity persisted in MongoDB
        │
        ├──[8a] 201 returned immediately to the extension
        │
        └──[8b] githubSyncService.enqueueSync(userId, activityId)
                    ── fire-and-forget; the HTTP response NEVER waits on GitHub
                    ▼
              per-user serial queue → runSync
                    ▼
              read+decrypt token → build markdown → commit to user's repo
              (retry on conflict/transient, attempt-capped)
                    ▼
              activity.githubSync.status updated: synced / failed / skipped
```

Three things in this flow are worth calling out.

**Deduplication is defence-in-depth.** The extension checks in memory, checks persisted recent sends, and the server checks again independently. A retry after a timeout — where the write actually succeeded but the response was lost — is exactly the case a client-side check alone cannot catch.

**GitHub sync is fire-and-forget by design.** Step 8b is not awaited. If it were, a slow GitHub API or a revoked token would delay or fail the user's solve record — coupling the *capture* of work to the *publication* of it. Capture is the critical path and stays fast and independent; publication is best-effort and self-healing.

**Sync state is stored on the activity itself.** `githubSync: { status, attempts, lastAttemptAt, commitSha, filePath, error }` lives on the Activity document. There is no separate job table: the work item *is* the record, which is what makes recovery after a restart a simple query.

### 6.3 The AI Assistant's grounded answer

```
User question → POST /api/assistant (rate-limited 15/10min)
      ▼
context.service — builds the user's real state by calling
      workloadService · analyticsService · Task · Activity · Note
      DIRECTLY as in-process functions (no internal HTTP)
      ▼
system prompt = the user's actual context
      ▼
groq.service → api.groq.com (the single file that knows the LLM exists)
      ▼
answer grounded in that user's own data
```

The isolation of `groq.service.js` is deliberate: swapping the provider, model, or adding streaming is a change to one file. Nothing else in the codebase knows an LLM is involved.

---

## 7. External Integrations

| Service | Purpose | Isolated in | Failure posture |
|---|---|---|---|
| **MongoDB Atlas** | Primary datastore | `config/db.js` + models | Fatal — server refuses to start |
| **GitHub API** | OAuth identity + journal commits | `auth/github.service.js`, `github/sync/githubWriter.js` | Degrades — sync retries, app unaffected |
| **Groq** | LLM completions | `assistant/groq.service.js` | Degrades — assistant reports unconfigured |
| **Gmail SMTP** | Reminder email | `notifications/email.service.js` | Degrades — reminder stays eligible for next tick |

Every third-party dependency sits behind exactly one module, and every one except the database is non-fatal. GitHub can be down, the LLM unconfigured, and email broken, and a user can still sign in, solve problems, have them captured, and see their analytics.

### GitHub token handling
OAuth access tokens are **encrypted at rest with AES-256-GCM** before being stored, and decrypted only at the moment of an API call. GCM is authenticated encryption, so tampering is detected rather than silently decrypted into garbage. The IV, auth tag, and ciphertext are packed into one string.

### Background workers
Two in-process schedulers, started by `server.js`, using the same deliberate pattern: **an interval, no external queue infrastructure.**

- **GitHub sync backstop** — every 10 min, re-queues anything pending or failed below the attempt cap.
- **Reminder dispatcher** — every 60 s, sends due task and placement reminders.

Both run once at boot to catch anything that became due while the process was down, and both are idempotent: a reminder counts as sent only after a *successful* send (`emailSentAt`), and a reminder more than 24 hours stale is marked handled without sending, because a day-old reminder is noise. The honest trade-off: this design assumes a single API instance. Horizontal scaling would require moving to an external queue or leader election — a documented boundary, not an oversight.

---

## 8. Deployment Architecture

### Production

```
   Browser ──► Vercel CDN ──────────► React SPA (static)
      │            (frontend/vercel.json → SPA rewrite)
      │
      └──────► Render Web Service ──► Express API (Node 20)
                     │                 CORS allowlist =
                     │                 CLIENT_URL / FRONTEND_URL
                     ▼
               MongoDB Atlas

   Extension ──────► Render Web Service (same API, same JWT auth)
   Extension ──────► distributed as a zip from the app's /install page
```

Frontend and backend are on **different origins**, which is the reason CORS is an explicit env-driven allowlist and why the SPA needs an absolute `VITE_API_BASE_URL` rather than a relative `/api`.

### Local / self-hosted (`docker-compose.yml`)

The compose topology is intentionally *not* the same as production, and understanding the difference matters:

```
   Browser ──► nginx :80 ──┬── /        → static SPA build
                           └── /api/    → proxy → backend:5000
                                                      │
                                                  mongo:27017
```

Under compose, nginx **reverse-proxies `/api` to the backend**, putting both on one origin so CORS is irrelevant. In production Vercel and Render are separate origins, so CORS is load-bearing. Same code, two topologies — the API base URL is what switches between them.

Both images are multi-stage: the backend installs production-only dependencies in a builder stage and runs as a **non-root `momentum` user**; the frontend builds with Node and ships only static assets on nginx. Both declare healthchecks.

### Configuration and environments

`config/env.js` validates configuration at startup and is **strict in production, lenient in development** — short JWT secrets or a missing `GITHUB_TOKEN_ENCRYPTION_KEY` are warnings locally but refuse to boot in production. This is what makes a misconfigured deploy fail immediately and loudly rather than silently running with weak crypto.

The extension has no runtime configuration: `scripts/build-extension.js` **injects environment at build time**, rewriting `config/env.js`, the `manifest.json` host permissions and content-script match patterns, and the popup's links from localhost to production URLs. All of them derive from the same two variables in the build script, so they cannot drift apart.

### CI

GitHub Actions on every push and PR to `main`: syntax-check all backend sources, install and build the frontend, and build both Docker images (build only, no push). **There is no automated test suite** — CI verifies that the code parses, builds, and containerises, not that it behaves correctly.

---

## 9. Architectural Decisions Worth Naming

**A stateless API.** No sessions, no server-side auth state. Every request carries its own JWT, verified with a secret. Refresh tokens are the only auth state in the database, stored as SHA-256 hashes in a TTL-indexed collection so expiry is the database's job.

**Refresh tokens in their own collection.** They were once an array embedded on the User document with a TTL index — a configuration in which Mongo deletes the *entire parent document* when any array element expires, silently destroying whole accounts about 30 days after first login. The fix was structural (separate collection, one document per token) and `config/db.js` still drops the legacy index defensively on connect. A good reminder that a TTL index on an embedded array is a data-loss bug, not a cleanup strategy.

**Feature modules, not technical layers.** The backend groups by domain (`task/`, `activity/`, `workload/`) rather than by type (`controllers/`, `services/`). Everything about a feature is in one folder; a change is local; nothing forces a walk across four sibling directories.

**Precision preserved at the source, not reconstructed later.** Solve duration is stored as both `durationSeconds` (precise, from the judge's own timer) and `durationMinutes` (coarse). Display paths prefer seconds and fall back to minutes. Rounding at write time would have been irreversible.

**Reads compute, writes persist.** Analytics and workload are computed on request from raw activities rather than maintained as denormalised counters. At a single user's data volume — bounded by a 98-day window and index-supported queries — this is fast, and it removes an entire class of drift bug where a cached aggregate disagrees with the underlying records.

**Polymorphic notes.** One `Note` model with `entityType` + `entityId` serves tasks, projects, and companies. One implementation, three surfaces, and adding a fourth attachable entity requires no schema change.

**Per-user serial queueing for GitHub.** Two solves landing seconds apart would otherwise race to update the same Git ref and lose a commit. `sync.service.js` chains each user's syncs into a promise queue keyed by `userId`, so a single user's writes are strictly sequential while different users still proceed in parallel — the minimum coordination needed, and no more.

---

## 10. Reading the System

A practical order for someone new to the codebase:

1. **`backend/app.js`** — the entire HTTP surface on one screen.
2. **`backend/modules/task/`** — the simplest complete module; learn the four-layer pattern once.
3. **`frontend/src/api/client.js`** — every network call in the app passes through here.
4. **`frontend/src/auth/AuthProvider.jsx`** — the session lifecycle.
5. **`extension/background.js`** — the message router the whole extension revolves around.
6. **`backend/modules/github/sync/`** — the most involved subsystem: queueing, retries, and external I/O.

---

## 11. Next

- **Phase 3 — Backend Deep Dive:** the eleven modules, the API surface, and the data model in detail.
- **Phase 4 — Extension Engineering:** detection strategy, adapters, offline queue, MV3 lifecycle.
- **Phase 5 — Feature-Level Implementation:** every major feature end to end, and how they interlock.
- **Phase 6 — Technical Implementation:** layer-by-layer engineering decisions, shared primitives, security, and technical debt.
- **Phase 7 — End-to-End System Flows:** complete request/data journeys across every layer.
- **Phase 8 — Engineering Decisions & Insights:** the reasoning, trade-offs, challenges, and lessons behind the build.

---

*Momentum — Protect Your Progress.*
