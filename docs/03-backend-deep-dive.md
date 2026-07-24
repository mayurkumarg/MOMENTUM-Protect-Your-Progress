# Momentum — Backend Deep Dive

**Phase 3 of the Momentum documentation series.**

Phase 2 described the system's shape. This document goes inside the API: the request lifecycle, the data model, all eleven domain modules, and — in depth — the complete implementation of the AI Assistant, including a precise answer to the question *"is this RAG?"*

---

## 1. The Request Lifecycle

Every authenticated request follows the same path. Understanding this once explains all 46 endpoints.

```
HTTP request
   │
   ▼  helmet                    security headers
   ▼  cors                      env-driven origin allowlist
   ▼  express.json              body parse, 1 MB cap
   ▼  router match              /api/<domain>
   ▼  authMiddleware            verify JWT → req.user = { userId }
   ▼  rateLimiter               (only on expensive/abusable routes)
   ▼  controller                read req, call service, shape response
   ▼  service                   business logic, scoped by userId
   ▼  Mongoose model            query / mutate MongoDB
   │
   ├── success → { success: true, data }
   └── throw   → next(err) → errorMiddleware → { success: false, message }
```

**Two invariants hold everywhere.** First, `userId` comes from the verified token and never from the request body or query — a client cannot ask for another user's data because it has no way to name another user. Second, every response uses the same envelope, which is why the frontend's `client.js` can unwrap `data` generically for every endpoint in the app.

---

## 2. Module Anatomy

All eleven modules use the same four files. The consistency is the point: read one module, and you can navigate any of them.

| File | Responsibility | Must not contain |
|---|---|---|
| `*.routes.js` | Path → handler binding; attach `authMiddleware` and rate limiters | Logic |
| `*.controller.js` | Read `req`, call service, send response, `next(error)` | Business rules, DB access |
| `*.service.js` | All business logic; throws `AppError`; HTTP-agnostic | `req` / `res` |
| `*.model.js` | Schema, indexes, enums, hooks, virtuals | Cross-module logic |

The discipline that matters most is **keeping services free of `req`/`res`**. Because `workloadService.computeWorkloadSummary(userId)` is a plain function rather than an HTTP handler, the Assistant's context builder calls it directly — one implementation of the workload rules serving both the REST endpoint and the AI, with no duplication and no internal network hop. That single decision is what makes the Assistant cheap to build.

---

## 3. The Data Model

Seven collections. Every document is owned by exactly one user.

```
                        ┌──────────┐
                        │   User   │
                        └────┬─────┘
                             │ userId (required, indexed) on every collection
     ┌──────────┬────────────┼────────────┬──────────────┬─────────────┐
     ▼          ▼            ▼            ▼              ▼             ▼
┌─────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐  ┌──────────┐  ┌──────────────┐
│  Task   │ │Activity│ │ Company  │ │  Note   │  │  Github  │  │ RefreshToken │
│         │ │        │ │          │ │         │  │Integration│  │              │
└────┬────┘ └────────┘ └────▲─────┘ └────┬────┘  └──────────┘  └──────────────┘
     │                      │            │
     └──── companyId ───────┘            │ entityType + entityId
                                         │ (TASK | PROJECT | COMPANY)
                                         └──── polymorphic attachment
```

### User
`authProvider` (`email` | `github`), `email`, `password` (`select: false`), `githubId`, `username`, `avatar`, `role`, and `notificationPreferences.reminderChannel` (`IN_APP` | `EMAIL` | `BOTH`, defaulting to `BOTH`).

The `select: false` on `password` means it is excluded from queries unless explicitly requested with `.select('+password')` — a schema-level guard against accidentally serialising a hash into an API response.

### Task
`title`, `description`, `estimatedHours`, `deadline`, `status` (`PENDING`/`IN_PROGRESS`/`COMPLETED`), `priority` (`LOW`/`MEDIUM`/`HIGH`), `completedAt`, `subtasks[]`, `tags[]`, `reminder`, and an optional `companyId` linking it to the Placement Tracker.

`completedAt` is maintained by a pre-save hook rather than trusted from the client — set when status becomes `COMPLETED`, cleared on reopen. Analytics depends on it, so it cannot be allowed to drift.

### Activity — the system's centre of gravity
`source` (`MANUAL` | `DSA` | `GITHUB`), `activityType` (`CODING`/`STUDY`/`ASSIGNMENT`/`PROJECT`/`REVISION`/`OTHER`), `title`, `durationMinutes`, **`durationSeconds`**, `isEstimatedDuration`, `activityDate`, `metadata` (platform, url, difficulty, language, solvedAt), and an embedded `githubSync` sub-document.

Two design choices deserve attention:

**Dual duration fields.** `durationSeconds` holds the precise value read from the judge's own timer; `durationMinutes` is the coarse rounded value. Rounding at write time would have been irreversible, so both are stored and display paths prefer seconds.

**Sync state embedded on the record.** `githubSync: { status, attempts, lastAttemptAt, commitSha, filePath, error }` lives on the Activity itself. There is no separate jobs table — the work item *is* the record, which makes recovery after a restart a single query (`status: 'failed', attempts: { $lt: MAX }`).

Four compound indexes support the real query patterns:
```
{ userId: 1, activityDate: -1 }                     timeline, analytics window
{ userId: 1, source: 1 }                            DSA-only views
{ userId: 1, activityType: 1 }                      type filters
{ userId: 1, source: 1, title: 1, activityDate: -1 } duplicate detection
```

### Company (Placement Tracker)
`name`, `role`, `location`, `packageInfo`, `resumeVersion`, `applicationDate`, `status` across nine states — `WISHLIST → PREPARING → APPLIED → OA_SCHEDULED → OA_COMPLETED → INTERVIEWING → SELECTED / REJECTED / WITHDRAWN` — plus `importantDates[]`, each carrying its own reminder with **separate `notifiedAt` and `emailSentAt` markers** so the in-app and email channels can never suppress one another.

### Note
Polymorphic by design: `entityType` + `entityId` instead of a hardcoded `taskId`. One model serves tasks, projects, and companies, with `isPinned`, checklists, tags, and file attachments.

### GithubIntegration
Per-user GitHub connection: the **AES-256-GCM-encrypted** access token, selected repository, and connection metadata.

### RefreshToken
One document per issued refresh token — `userId`, `tokenHash` (SHA-256), `expiresAt` with a TTL index. Its own collection, deliberately: it was once an embedded array on `User`, where a TTL index deletes the *entire parent document* when any array element expires, silently destroying accounts ~30 days after first login.

---

## 4. The Modules

### 4.1 `auth` — identity
10 endpoints. Email register/login, GitHub OAuth (login *and* in-session linking), token refresh, logout, `/me`, email change, notification preferences.

Access tokens are short-lived (15 min in production) and refresh tokens last 30 days. Rotation is single-use with a **60-second grace window** so the web app and extension — which share one refresh token — can redeem concurrently without either being logged out. Rate-limited at four different points: login, registration, refresh, and OAuth start.

### 4.2 `user` — profile and serialisation
Owns `serializeUser`, the single function deciding what a user object looks like over the wire. Password hashes and refresh tokens simply have no path to a response body.

### 4.3 `task` — planning
Standard CRUD, but `estimatedHours` and `deadline` are load-bearing: they feed the workload engine directly.

### 4.4 `activity` + `dsa-activity` — capture
Two routers over one model. `/api/activities` is generic CRUD; `/api/dsa` is the **extension's dedicated ingress**, with its own server-side duplicate check and the fire-and-forget GitHub sync trigger. Separating them means the extension's contract can evolve without touching the general activity API.

### 4.5 `workload` — the rules engine
One endpoint, four classifications, from three parallel queries. Thresholds are constants at the top of the file — the rules are transparent by choice, because a student should be able to understand *why* they were told they are overloaded.

### 4.6 `analytics` — the mirror
One endpoint returning a 98-day heatmap, current/longest streaks, week-over-week comparison, platform breakdown, and task completion. Computed on read from raw activities rather than maintained as counters, which eliminates the entire class of bug where a cached aggregate disagrees with the records beneath it.

### 4.7 `github` — integration and journal
7 endpoints plus the `sync/` subsystem (`sync.service`, `githubWriter`, `journal`, `scheduler`). Tokens are decrypted only at call time. `journal.js` is deliberately **pure and I/O-free** — it turns an Activity into markdown and knows nothing about HTTP — so the repository's format can change without touching network code.

### 4.8 `notes` — polymorphic notes with attachments
8 endpoints including upload and download. The upload middleware is the most security-conscious file in the codebase:

- **MIME allowlist**, not a blocklist — and `image/svg+xml` is *explicitly excluded* because an SVG can carry embedded `<script>`, making it a stored-XSS vector even when served as a download.
- **Randomised filenames** (`crypto.randomBytes(16)`), so the user's original filename is never interpolated into a filesystem path. This eliminates path traversal outright instead of relying on sanitising input.
- 15 MB cap, one file per request, and Multer errors translated into normal `AppError`s.

### 4.9 `companies` — the placement pipeline
CRUD plus `computePlacementSummary`, which derives headline counts. Note the subtlety in `applied`: it counts everything *past* the Wishlist and Preparing stages rather than only the `APPLIED` status, because a company now at `INTERVIEWING` was obviously also applied to.

### 4.10 `notifications` — reminders
No routes; a background service. Runs every 60 seconds, dispatching due task and placement reminders over Gmail SMTP. A reminder counts as sent only after a **successful** send, so a transient failure simply leaves it eligible next tick — that is the entire retry mechanism. Reminders more than 24 hours stale are marked handled without sending, because a day-old reminder is noise.

### 4.11 `assistant` — the AI layer
The subject of the next section.

---

## 5. The AI Assistant — Complete Implementation

### 5.1 Is it RAG? No — and that is the correct call

**It is Context-Augmented Generation, not Retrieval-Augmented Generation.** The distinction is not pedantic; it reflects a real architectural decision, and the project's own planning document (`AI assistence.docx`) states it explicitly: *"This is not RAG… Momentum already knows exactly where the information is. There is nothing to search."*

```
        TRADITIONAL RAG                    MOMENTUM
        ──────────────                     ────────
   Documents                          User's workspace
        │                                    │
   Chunking                            (already structured
        │                                and already ours)
   Embedding model                           │
        │                                    │
   Vector database                     7 deterministic
        │                              MongoDB queries
   Similarity search  ◄── question           │
        │                                    │
   Top-k chunks (probabilistic)        Complete snapshot
        │                              (deterministic)
        ▼                                    ▼
       LLM                                  LLM
```

RAG exists to solve **one specific problem: you have more knowledge than fits in a context window, and you do not know which part is relevant until the question arrives.** Neither condition holds here.

- **There is nothing to search.** The user's tasks live in the `tasks` collection. Their solves live in `activities`. Their companies live in `companies`. The location of every fact is known at development time. Embedding that data and then approximately searching for it would be an elaborate way of reconstructing a `WHERE userId = ?` that already exists.
- **The whole dataset fits.** One user's open tasks, today's solves, recent activity, streaks, and companies serialise to a few kilobytes — bounded by explicit limits in the code (15 open tasks, 8 recent activities, 20 companies). There is no compression problem to solve.
- **Retrieval would make it worse.** Similarity search is *probabilistic*: it returns the top-k most similar chunks and can silently miss a relevant one. For "what's due tomorrow?", missing a task is a correctness failure. A deterministic query cannot miss.

Using a vector database here would add an embedding pipeline, a second datastore, an index-freshness problem, and a new class of retrieval bug — in exchange for strictly worse guarantees. **Choosing not to build RAG is the engineering decision worth defending in an interview**, and it is a stronger answer than having built it reflexively.

### 5.2 The pipeline

```
POST /api/assistant/chat   { messages: [...] }
   │
   ▼  authMiddleware              → req.user.userId
   ▼  assistantLimiter            15 requests / 10 min (LLM calls cost money)
   ▼  assistant.controller        thin: extract, delegate, respond
   │
   ▼  assistant.service ─── sanitizeMessages()
   │        validate roles · trim to 8000 chars · keep last 12
   │        · assert final message is from the user
   │
   ▼  context.service ──── buildUserContext(userId)
   │        7 sections, Promise.all, each independently fail-soft
   │
   ▼  prompt.js ────────── buildSystemPrompt(context)
   │        PERSONA + CONTEXT_GUIDE + JSON snapshot
   │
   ▼  groq.service ─────── createChatCompletion([system, ...history])
   │        Llama 3.3 70B · temperature 0.4 · 1024 max tokens · 30s timeout
   │
   ▼  { reply, model }
```

### 5.3 The context builder — the heart of the system

`context.service.js` assembles the snapshot from **seven sections running in parallel**:

| Section | Source | Content |
|---|---|---|
| `workload` | `workloadService` (direct call) | The four classifications |
| `tasks` | `Task` model | ≤15 open (deadline-sorted), ≤15 completed this week, overdue/due-soon counts |
| `dsaToday` | `Activity` model | Today's solves, minutes, difficulty and platform counts |
| `recentActivity` | `Activity` model | 8 most recent across all sources |
| `analytics` | `analyticsService` (direct call) | Streaks, weekly comparison, breakdowns |
| `github` | `githubService` + counts | Connection, repo, synced/pending/failed |
| `placements` | `companyService` + cross-refs | Summary + ≤20 companies with linked tasks and notes |

Four design decisions carry this file:

**1. Reuse, never recompute.** The builder calls the *same* services and models that power the UI. The Assistant therefore cannot tell the user something different from what the dashboard shows — a whole category of "the AI said 5 but the screen says 3" bug is structurally impossible.

**2. Fail-soft per section.** Every section is wrapped:

```js
const safe = async (label, fn) => {
  try { return await fn(); }
  catch (error) {
    console.error(`[assistant] context section "${label}" failed:`, error.message);
    return null;               // ← this section only
  }
};
```

If GitHub is unreachable, `github` is `null` and the other six still arrive. The assistant degrades from *fully informed* to *partially informed*, never to *broken*. And the prompt explicitly instructs the model to read `null` as **"unavailable," not "zero"** — which is the difference between "you have no companies" and "I couldn't load your companies."

**3. Every list is bounded.** `OPEN_TASK_LIMIT = 15`, `RECENT_ACTIVITY_LIMIT = 8`, `COMPANY_LIMIT = 20`, `PENDING_TASK_PREVIEW_LIMIT = 5`. A power user with 400 tasks produces the same prompt size as a new user with three. **Token cost and latency are bounded by construction**, not by hope.

**4. Deliberate omission.** The analytics section strips the 98-cell heatmap before including the summary:

> *"the model doesn't need per-day granularity, just the headline signals."*

Sending 98 daily counts would spend hundreds of tokens on data the model would only ever summarise back.

**5. Pre-computed derived fields.** The builder computes `daysUntilDeadline`, `overdue`, `subtaskProgressPct`, and `prepProgressPct` in JavaScript rather than shipping raw timestamps and asking the model to do date arithmetic. LLMs are unreliable at exactly that kind of calculation, so the deterministic layer does it and the model is left to do what it is good at — prioritising and explaining.

### 5.4 Prompt assembly

`prompt.js` produces a three-part system prompt:

**PERSONA** — role and behavioural rules. The grounding constraints matter most: *"Do not invent tasks, deadlines, numbers, streaks, or activity that isn't there"*, *"If the data needed is missing… say so plainly"*, and — a genuinely thoughtful one — *"Never claim to have taken an action (created a task, sent a reminder, pushed a commit). You can only advise and inform right now."* That last rule closes the failure mode where a model helpfully says "I've added that to your list" and the user believes it.

**CONTEXT_GUIDE** — a field-by-field reading key: what `overloadStatus` means, that a negative `daysUntilDeadline` means overdue, that the nine company statuses exist, and that `prepProgressPct` is `null` (not `0`) when no prep tasks are linked — *"say that plainly rather than reporting 0%."*

**The snapshot** — the context object as pretty-printed JSON in a fenced block.

The final message array:

```
[
  { role: 'system',    content: PERSONA + CONTEXT_GUIDE + JSON snapshot },
  ...up to 12 sanitized prior messages...,
  { role: 'user',      content: "what should I work on today?" }
]
```

### 5.5 Conversation state — stateless by design

There is **no conversation collection**. History lives on the client and is sent with each turn; the server validates and bounds it. The trade-offs are explicit: the API stays horizontally scalable and stores no chat logs, at the cost of larger request bodies and no cross-device history.

The sanitiser is defensive because that history is client-controlled input: roles are restricted to an allowlist, content is trimmed to 8000 characters, the window is capped at 12 messages, and **the last message must be from the user** — otherwise a client could submit a fabricated assistant turn as the thing to respond to.

Critically, the workspace snapshot is **rebuilt from the database on every single turn**, never carried forward in history. Ask "what's due today?", complete a task, then ask again — the second answer reflects the change. A cached snapshot would confidently report stale state.

### 5.6 The provider boundary

`groq.service.js` is the **only file in the entire codebase that knows an LLM exists.** Everything else deals in messages and context.

It targets Groq's OpenAI-compatible endpoint with `llama-3.3-70b-versatile`, `temperature: 0.4` (low — this is a factual assistant, not a creative one), `max_tokens: 1024`, and a 30-second timeout. Errors are mapped to honest user-facing messages while the real provider error is logged server-side:

| Condition | Status | User sees |
|---|---|---|
| No API key | 503 | "not configured yet" |
| Timeout | 504 | "took too long to respond" |
| Provider 401 | 502 | "credentials are invalid" |
| Provider 429 | 429 | "rate-limited right now" |
| Empty completion | 502 | "returned an empty response" |
| Anything else | 502 | "temporarily unavailable" |

A separate `GET /api/assistant/status` lets the UI discover whether the assistant is configured *before* the user types a question — so an unconfigured deployment shows a clear state rather than failing on first use.

### 5.7 Plan versus implementation

Comparing `AI assistence.docx` to the shipped code shows three deliberate divergences worth recording:

| Aspect | Plan | Implemented | Why the change is right |
|---|---|---|---|
| Context format | Human-readable prose summary | **Pretty-printed JSON + field-notes guide** | JSON is unambiguous and machine-parseable; prose requires re-serialising and can blur which number means what. The `CONTEXT_GUIDE` recovers the readability the prose was meant to provide. |
| Conversation store | Server-side ("Store Conversation") | **Stateless; client sends history** | Keeps the API horizontally scalable and stores no chat logs. |
| Sections | Tasks, Workload, DSA, GitHub | **Those four plus Analytics and Placements** | The plan predicted this: *"if you later add Notes, Calendar, Files, or Placement Tracking, you only extend the Context Builder."* Adding Placements touched exactly one file — the design held. |

That last row is the strongest evidence the architecture is sound: a significant feature was added later by extending one function, with the prompt, transport, and orchestration untouched.

### 5.8 What would have to change for real RAG

Stated concretely, since the honest answer to "why didn't you use RAG?" is better with a migration path attached. RAG becomes the right tool the moment the assistant needs to answer over **unbounded free text** — full note bodies, uploaded PDFs, or interview-experience write-ups — where the relevant passage genuinely cannot be predicted. That would require an embedding pipeline, a vector store, chunking with re-embedding on edit, and a retrieval step feeding the same prompt assembler.

The current design accommodates that: retrieval would become an **eighth section** in `context.service.js`. The prompt assembler, transport, and orchestration would not change. Today only note *titles* and *counts* enter the context, never bodies — which is precisely the boundary at which structured context stops being sufficient.

---

## 6. Cross-Cutting Concerns

**Error handling.** `AppError` marks *operational* errors (`isOperational: true`) — expected conditions with a safe message. `errorMiddleware` maps Mongoose failures (`ValidationError` → 400, `CastError` → 400, duplicate key `11000` → 409) and applies the key security rule: any error **not** deliberately thrown as an `AppError` has its message replaced with a generic string, so driver internals and collection names never reach a client. 5xx errors are logged with full detail server-side.

**Validation in layers.** Mongoose schema constraints as the last line; explicit input validation in services (`auth.validation.js`); `ObjectId` format checks before queries so a malformed id returns 400 rather than a `CastError`; body size capped at 1 MB; and per-file upload limits.

**Rate limiting by cost.** Seven limiters sized to what each endpoint actually costs — the assistant's 15-per-10-minutes exists because every call spends real LLM budget, while registration's 8-per-hour exists to stop account-farming.

**Fail-fast configuration.** `config/env.js` is strict in production and lenient in development: a short `JWT_SECRET` or missing `GITHUB_TOKEN_ENCRYPTION_KEY` is a warning locally and a refusal to boot in production.

---

## 7. Details Worth Noticing

- **`journal.js` is pure.** No I/O, no network — Activity in, markdown out. Trivially testable, and the repo format can change without touching API code.
- **Per-user serial GitHub queue.** Concurrent solves would race to update the same Git ref; syncs are chained per `userId` so one user's writes are sequential while different users proceed in parallel.
- **Dual reminder markers.** `notifiedAt` (in-app) and `emailSentAt` (email) are separate fields precisely so the two channels can never suppress each other.
- **`applied` counts past stages, not one status** — a company at `INTERVIEWING` was also applied to.
- **SVG is excluded from uploads on purpose**, with the reason written in the code.
- **The legacy TTL index is still dropped defensively on every connect**, long after the schema was fixed.

---

## 8. Next

- **Phase 4 — Extension Engineering:** adapters, detection strategy, offline queue, MV3 lifecycle.
- **Phase 5 — Feature-Level Implementation:** every major feature end to end, and how they interlock.
- **Phase 6 — Technical Implementation:** layer-by-layer engineering decisions, shared primitives, security, and technical debt.
- **Phase 7 — End-to-End System Flows:** complete request/data journeys across every layer.
- **Phase 8 — Engineering Decisions & Insights:** the reasoning, trade-offs, challenges, and lessons behind the build.

---

*Momentum — Protect Your Progress.*
