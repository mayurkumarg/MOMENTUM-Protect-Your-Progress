# Momentum — Technical Implementation

**Phase 6 of the Momentum documentation series.**

Phase 2 mapped the architecture; Phases 3–5 covered the backend, extension, and features. This document is about **engineering decisions**: the patterns that recur across the codebase, the shared primitives everything is built on, and the reasoning behind choices that could have gone another way.

It answers: *how is Momentum implemented internally, and what decisions make it work?*

---

## 1. The Technology Choices

| Layer | Choice | Why this one |
|---|---|---|
| Runtime | Node 20 | Same language across API, extension, and build tooling |
| API | Express 4 | Minimal, unopinionated; the structure is imposed by the codebase, not the framework |
| Database | MongoDB + Mongoose | Schema-flexible for evolving domains; Mongoose adds validation and hooks back |
| Frontend | React 18.3 + Vite | Fast builds, standard component model |
| Routing | React Router 6 | Nested routes enable structural route guards |
| Styling | Tailwind + CSS custom properties | Build-time only; zero runtime cost |
| Icons | lucide-react | Tree-shakeable, single icon dependency |
| Extension | Manifest V3, vanilla JS | No bundler needed; MV3 constrains module loading anyway |
| LLM | Groq (Llama 3.3 70B) | OpenAI-compatible API, isolated behind one file |

**The frontend runtime dependency list is four packages**: `react`, `react-dom`, `react-router-dom`, `lucide-react`. Tailwind, PostCSS, and Vite are dev dependencies that compile away. No Redux, no React Query, no component library, no UI framework.

That is a deliberate stance rather than minimalism for its own sake. Every dependency is a version to maintain, an API to learn, and a failure mode to debug. This app's needs — fetch, cache-per-screen, render — are met by ~50 lines of custom hook. Choosing a library here would trade a small amount of code for a large amount of surface area.

---

## 2. Frontend Implementation

### 2.1 The four-layer stack

```
pages/        16 screens — composition only
   ▲
hooks/        15 domain hooks (useTasks, useWorkload, …)
   ▲          all wrapping ONE primitive: useAsyncData
api/          one module per backend domain
   ▲          the only place endpoint paths are written
api/client.js single fetch wrapper — auth, refresh, error normalisation
```

The rule that gives this its value: **`client.js` is the only code in the application that calls `fetch`.** Because it is the sole path, cross-cutting behaviour can be implemented once — attaching the Bearer token, transparently refreshing an expired one and replaying the request, unwrapping the `{success, data}` envelope, and normalising every failure into an `ApiError` with a `status`. No component can bypass auth handling by reaching for `fetch` directly.

### 2.2 `useAsyncData` — a data layer in 50 lines

Every hook that reads from the API is built on one primitive returning `{ data, error, isLoading, isFetching, refetch }`.

Two details make it correct rather than merely short:

**An `active` flag prevents post-unmount state updates.** The cleanup function sets `active = false`, so a response arriving after navigation is discarded rather than warning in the console or writing to a dead component.

**`isLoading` and `isFetching` are distinct.** The first is "no data yet, show a skeleton"; the second is "refreshing data we already have, keep showing it." Conflating them causes the screen-flash-on-refetch problem.

### 2.3 State: scoped, not centralised

| Kind | Held by | Lifetime |
|---|---|---|
| Session | `AuthProvider` (Context) | App |
| Theme | `ThemeProvider` (Context + localStorage) | App |
| Toasts | `ToastProvider` (Context) | App |
| Server data | Per-hook local state | Screen |
| UI state | Component local state | Component |

Only genuinely global concerns get Context. Server data stays local to the screen that needs it, and **mutations refetch rather than patching a cache**:

```
mutate → await API → refetch() → re-render
```

This costs an extra round-trip and consciously forgoes optimistic UI. In exchange, the screen can never disagree with the server, and there is no cache-invalidation logic to get wrong. For an app where the same activity feeds five different views, that guarantee is worth more than the latency saved.

### 2.4 Provider composition

```jsx
<ErrorBoundary>        // outermost — catches failures in providers themselves
  <ThemeProvider>      // no dependencies
    <ToastProvider>    // AuthProvider needs it for errors
      <AuthProvider>   // needs toasts
        <BrowserRouter>
          <App />
```

The ordering is dependency-driven, and `ErrorBoundary` sits outside everything precisely so a crash *inside a provider* still renders a fallback rather than a blank page.

### 2.5 Theming without runtime cost

Colours are declared as **CSS custom properties holding space-separated RGB triplets**, which Tailwind consumes with alpha support:

```css
--color-canvas: 235 237 230;
```
```js
canvas: 'rgb(var(--color-canvas) / <alpha-value>)'
```

The triplet format (not `#ebede6`) is what lets `bg-canvas/50` work — Tailwind injects the alpha into the `rgb()` call. Dark mode is `darkMode: 'class'`, toggled by a single class on `<html>`, so **theme switching changes one class and repaints; no component re-renders and no JavaScript recalculates styles.**

The provider also updates `color-scheme` (so native form controls and scrollbars follow) and the `theme-color` meta tag (so mobile browser chrome matches). Preference persists to `localStorage`, with `system` stored as *absence of a key* rather than a literal value — so a user on `system` follows OS changes live via a `matchMedia` listener.

### 2.6 A design system, not a component library

`components/ui.jsx` exports twelve primitives: `Button`, `IconButton`, `Card`, `Badge`, `PageHeader`, `Section`, `EmptyState`, `Skeleton`, `LoadingState`, `ErrorState`, `Input`, `SegmentedControl`.

The three that matter most are `EmptyState`, `LoadingState`, and `ErrorState`. Because every screen uses the same three, **every screen handles the empty, loading, and failure cases** — the pattern makes forgetting them the harder path. This is why a new user sees composed, intentional empty states everywhere instead of blank panels.

### 2.7 Structural authorisation

```jsx
<Route element={<ProtectedRoute />}>
  <Route element={<AppShell />}>
    <Route path="/overview" … />
```

Protection is inherited from the route tree rather than checked inside each page. A screen added inside `AppShell` is protected **by construction** — there is no per-page check to forget.

---

## 3. Backend Implementation

### 3.1 Feature modules over technical layers

The backend groups by domain (`task/`, `activity/`, `workload/`) rather than by type (`controllers/`, `services/`, `models/`). Everything about a feature lives in one folder.

The practical difference: adding a field to a task touches `modules/task/` and nothing else. In a layer-organised codebase the same change means editing four sibling directories, and reviewing it means holding four files in your head.

### 3.2 The four-layer contract

Every module: `routes → controller → service → model`, with strict responsibilities (detailed in Phase 3). The load-bearing rule is that **services never see `req` or `res`.**

That single constraint is what made the AI Assistant cheap to build — `context.service.js` calls `workloadService.computeWorkloadSummary(userId)` and `analyticsService.computeAnalyticsSummary(userId)` as plain functions. One implementation of the workload rules serves the REST endpoint and the LLM context, with no duplication, no internal HTTP hop, and no possibility of the two disagreeing.

### 3.3 Errors: operational vs. programmer

```js
class AppError extends Error {           // isOperational = true
  constructor(message, statusCode) { … }
}
```

The distinction drives the security behaviour in `errorMiddleware`:

- **Operational** (`AppError`) — expected, message is safe to show: *"Email already registered"*.
- **Everything else** — a bug or driver failure. Its message may contain collection names, index details, or query internals, so **it is replaced with a generic string** before responding. The real error is logged server-side with full detail.

Mongoose failures are mapped explicitly: `ValidationError` → 400, `CastError` → 400 (*"Invalid {path}"*), duplicate key `11000` → 409 with the offending field named.

### 3.4 Validation in four layers

1. **Format** — regex checks in `auth.validation.js` (email shape, password requiring upper/lower/digit at 8+ chars, username 3–20 alphanumeric/underscore), returning a **field-keyed error object** so the UI can attach messages to inputs rather than showing one banner.
2. **Identifier** — `assertValidObjectId()` before any query, so a malformed id returns a clean 400 instead of a Mongoose `CastError`.
3. **Business** — enum membership, ownership, and state transitions in services.
4. **Schema** — Mongoose constraints as the final backstop.

### 3.5 Two guards worth naming

**Allowed-fields update guard.** Every update service declares an explicit `allowedFields` list and rejects anything outside it:

```js
const invalidFields = Object.keys(updates).filter(f => !allowedFields.includes(f));
if (invalidFields.length) throw new AppError(`Invalid update fields: …`, 400);
```

This is mass-assignment protection. Without it, `PATCH /api/tasks/:id` with `{ userId: "<someone else>" }` would happily reassign ownership. It **rejects** rather than silently stripping, so a client bug surfaces immediately instead of failing quietly.

**Clamped pagination.**

```js
const page  = Math.max(parseInt(query.page) || 1, 1);
const limit = Math.min(Math.max(parseInt(query.limit) || 10, 1), 100);
```

`?limit=999999` cannot be used to pull an entire collection into memory. The ceiling is server-side, which is why the Calendar hook documents that requesting `limit: 100` *is* the real maximum.

### 3.6 Serialisation as an explicit boundary

Every module has a `serialize*` function converting a Mongoose document to its wire shape — `_id` becomes `id`, and internal fields are dropped by omission rather than deletion.

`serializeUser` is the security-critical one: because the response is **constructed field by field**, a password hash or refresh token has no path into an API response even if someone later adds one to the schema. An implicit `toJSON()` would leak by default.

---

## 4. Database Design

### 4.1 Modelling decisions

**Embed what is owned; reference what is shared.** Subtasks, reminders, and `githubSync` are embedded — they have no independent life and are always read with their parent. Tasks, activities, and companies are separate collections with `userId` references.

**One exception, learned painfully.** Refresh tokens *were* embedded as an array on `User`. A TTL index on an embedded array field deletes the **entire parent document** when any element expires — silently destroying whole user accounts about 30 days after first login. They now live in their own collection, one document per token, and `config/db.js` still drops the legacy index defensively on every connect.

**Ownership in the filter, not in a check.** Services scope queries as `{ _id: id, userId }` rather than fetching then comparing. A missing ownership check becomes a 404 instead of a data leak, and it is one query instead of two.

### 4.2 Indexing to real query shapes

Indexes are compound and ordered to match actual usage — always `userId` first, since every query is user-scoped:

```
{ userId: 1, activityDate: -1 }                      timeline, analytics window
{ userId: 1, source: 1, title: 1, activityDate: -1 } duplicate detection
{ userId: 1, entityType: 1, entityId: 1, updatedAt: -1 }  polymorphic notes
{ expiresAt: 1 }  expireAfterSeconds: 0              TTL cleanup
```

The TTL index means **expired refresh tokens delete themselves** — no cleanup job, no cron, no accumulating dead rows.

### 4.3 Precision preserved at write time

`durationSeconds` (exact) and `durationMinutes` (coarse) are both stored. Rounding on write is irreversible; storing both costs one integer and keeps the option open. Display paths prefer seconds and fall back to minutes — which is how the UI can honestly say *"8m 27s"*.

### 4.4 Computed reads, not maintained counters

Analytics and workload derive everything from raw records at request time. No denormalised aggregates, no counters to increment, no reconciliation job.

The trade-off is explicit: this is O(records in window) per request, bounded by a 98-day window and served by an index. It would need revisiting at a much larger scale — but it eliminates the entire class of bug where a cached total silently disagrees with the rows beneath it, which for a data-integrity-focused product is the better trade.

---

## 5. Authentication & Authorisation

### 5.1 Two token classes

| | Access | Refresh |
|---|---|---|
| Lifetime | 15 min (prod) | 30 days |
| Storage | Client only | Client + **SHA-256 hash** server-side |
| Secret | `JWT_SECRET` | `JWT_REFRESH_SECRET` |
| Reuse | Many times | Single-use, rotated |

Refresh tokens are hashed with SHA-256 rather than bcrypt — deliberately. Bcrypt's slowness protects *low-entropy* human-chosen passwords against brute force. A signed JWT is already high-entropy, so the expensive KDF buys nothing and would add latency to every refresh.

`authMiddleware` explicitly rejects a refresh token presented as an access token (`decoded.type === 'refresh'` → 401). They are distinct credential classes and must not be interchangeable.

### 5.2 Rotation with a grace window

Rotation is single-use, but the retired token stays valid for **60 seconds**:

```js
retireRefreshToken(userId, token, GRACE_MS)   // sets expiresAt = now + 60s
```

This exists because the website and the extension hold the *same* refresh token and their access tokens expire simultaneously — both redeem at once, and strict single-use logs the loser out mid-session. The window never *extends* a token expiring sooner, so the token remains effectively single-use while absorbing the race.

### 5.3 Proactive renewal

The client refreshes **2 minutes before** expiry rather than reacting to a 401, and re-checks on `focus` and `visibilitychange` because background tabs have their timers throttled — a tab left open overnight would otherwise return with a long-dead token.

Only a genuine **401** ends a session. Network failures leave the session intact to retry, so a brief connectivity drop does not log the user out.

### 5.4 One OAuth app, three jobs

GitHub OAuth serves login, in-session account linking, and extension authorisation — disambiguated by a JSON `state` parameter. Two parts of that state are security-critical:

- **`linkToken`** is a *separately signed* JWT carrying the user id. The outer state is unsigned, so without this a caller could forge `linkUserId` and attach their GitHub account to someone else's Momentum account.
- **`extRedirect`** is validated against `/^https:\/\/[a-p]{32}\.chromiumapp\.org\/?$/` before being honoured. This supports unpacked extensions with changing IDs **without** turning the flow into an open redirect.

---

## 6. API Design

**Uniform envelope.** Every response is `{ success, data }` or `{ success, message }`. One shape means one unwrapping rule in `client.js`.

**Resource-oriented, with deliberate exceptions.** Mostly REST, but three endpoints are intentionally not CRUD because they describe *actions*, not resources: `POST /api/github/repo/select`, `POST /api/github/activity/:id/retry`, `POST /api/assistant/chat`. Contorting these into resource semantics would obscure what they do.

**A separate ingress for the extension.** `/api/dsa/activity` exists alongside generic `/api/activities` so the extension's contract can evolve independently, and so its specific concerns — server-side dedup, fire-and-forget GitHub sync — live in one controller rather than complicating general activity CRUD.

**Meaningful status codes.** `409` is used for both duplicate resources and duplicate activity — and the extension treats a `409` on submit as **success**, because the server confirming it already has the record is exactly the outcome the client wanted.

---

## 7. Cross-Cutting Implementation

### 7.1 Shared utilities as drift prevention

`utils/dateStats.js` exists for one reason, stated in its own comment:

> *"every day-bucketing computation in this codebase (streaks, heatmap, active-day counts) must key off this, not `Date#toDateString()` or a re-parsed Date, so they can't silently drift apart."*

Streaks, the heatmap, active-day counts, and the workload consistency check all call `formatDateKey()`. If each computed its own day boundary, the heatmap and the streak counter would eventually disagree by a day at some timezone edge — a bug that is nearly impossible to notice and very hard to trace.

`utils/crypto.js` plays the same role for encryption: one AES-256-GCM implementation, packing IV, auth tag, and ciphertext into a single string. GCM is *authenticated* encryption, so tampering fails loudly instead of decrypting into garbage.

### 7.2 Configuration: strict in production, lenient in development

```js
const enforce = (condition, message) => {
  if (!condition) return;
  if (isProduction) throw new Error(message);   // refuse to boot
  console.warn(`[env] ${message}`);             // warn and continue
};
```

Five variables are required unconditionally. Secrets under 32 characters and a missing `GITHUB_TOKEN_ENCRYPTION_KEY` are **warnings locally, fatal in production**. Optional integrations (Groq, Gmail) only ever warn — the app runs without them, with those features disabled.

This is what makes a misconfigured production deploy fail immediately and loudly, while a developer can clone the repo and run it without generating four secrets first.

### 7.3 Rate limiting priced by cost

Seven limiters, each sized to what the endpoint actually costs:

| Endpoint | Limit | Why |
|---|---|---|
| Login | 10 / 15 min | Credential stuffing |
| Register | 8 / hr | Account farming |
| Refresh | 30 / 15 min | Legitimate clients refresh often |
| OAuth start | 20 / 15 min | Redirect abuse |
| Assistant | 15 / 10 min | **Every call spends real LLM budget** |
| GitHub writes | 20 / 15 min | Upstream API quota |
| Email change | 5 / hr | Account takeover attempts |

In production `trust proxy` is enabled so limits key on the real client IP rather than Render's proxy — without it, every user would share one bucket.

### 7.4 Background work without infrastructure

Two in-process schedulers, deliberately not a queue system:

| | GitHub sync backstop | Reminder dispatcher |
|---|---|---|
| Interval | 10 min | 60 s |
| Job | Re-queue pending/failed below cap | Send due reminders |
| Idempotency | `githubSync.status` on the activity | `emailSentAt` on the reminder |

Both run once at boot to catch work that came due while the process was down. Both are idempotent through state on the record itself, so a restart mid-run cannot double-send.

**The concurrency control worth noting** is the per-user serial queue in `sync.service.js`:

```js
const previous = userQueues.get(key) || Promise.resolve();
const next = previous.then(task, task).catch(() => {});
userQueues.set(key, next);
```

Two solves seconds apart would otherwise race to update the same Git ref and lose a commit. Chaining per `userId` makes one user's writes strictly sequential while different users still proceed in parallel — the minimum coordination required, and no more.

**The honest limitation:** this design assumes a single API instance. Two instances would run duplicate schedulers, and the in-memory `userQueues` map would not coordinate between them. Horizontal scaling needs an external queue or leader election. That is a documented boundary, not an oversight — and at current scale, adding Redis to avoid it would be infrastructure serving a hypothetical.

---

## 8. Security Implementation

| Concern | Implementation |
|---|---|
| Password storage | bcrypt, configurable rounds (default 10) |
| Password exposure | `select: false` on the schema field |
| Token storage | Refresh tokens SHA-256 hashed; never stored raw |
| Third-party tokens | AES-256-GCM encrypted at rest |
| Transport | HTTPS everywhere (Vercel + Render) |
| Headers | Helmet, with CSP disabled — a JSON API has no HTML for CSP to protect |
| CORS | Explicit env-driven allowlist; no wildcard |
| Injection | Mongoose parameterisation; enums validated before query |
| Mass assignment | Explicit `allowedFields` per update |
| Path traversal | Upload filenames randomised — user input never reaches a path |
| Stored XSS | `image/svg+xml` excluded from uploads (SVG can embed `<script>`) |
| Error leakage | Non-operational error messages replaced with a generic string |
| Body size | 1 MB cap |
| Tenant isolation | `userId` from verified token, in every query filter |

**The most important line of defence is the last one.** A client has no way to *name* another user — `userId` comes only from the verified token — so cross-tenant access is not merely checked, it is unexpressible.

---

## 9. Extension Implementation Patterns

Covered fully in Phase 4; the three patterns worth restating as engineering decisions:

**Strategy/adapter separation.** `content-script.js` owns detection *strategy* — submit windows, mutation observation, debouncing, SPA navigation, retries — and contains no selectors. Seven adapters own site knowledge. Adding a platform is one new file. This is the difference between 3,000 lines that scale to eight platforms and 3,000 lines that need rewriting for the eighth.

**Persistence over memory, forced by MV3.** The service worker can be terminated at any moment, so tokens, the offline queue, problem session start times, and sync status all live in `chrome.storage.local`. In-memory structures are a fast path in front of durable state, never the record. `chrome.alarms` replaces `setInterval` because an alarm survives worker termination and a timer does not.

**Degrade, never break the host page.** A content script is a guest. When the extension context is orphaned, every `chrome.*` entry point is guarded by `isExtensionAlive()` and fails silently — critically including `content.js`, which wraps the site's own `fetch` and could otherwise break the Momentum website itself.

---

## 10. AI Implementation

**Context-Augmented Generation, not RAG** — no embeddings, no vector store, no similarity search. Seven deterministic queries build a bounded snapshot which becomes the system prompt. RAG solves "knowledge exceeds the context window and you cannot predict what is relevant"; neither condition holds when the data is yours, structured, and a few kilobytes.

Four implementation properties carry it:

- **Reuse over recompute** — calls the same services the UI uses, so the assistant cannot contradict the dashboard.
- **Fail-soft per section** — one broken data source yields `null` for that section only, and the prompt distinguishes *unavailable* from *zero*.
- **Bounded everything** — 15 tasks, 8 activities, 20 companies, 12 messages, 8000 chars. Token cost and latency are constant regardless of user size.
- **Deterministic pre-computation** — `daysUntilDeadline`, `overdue`, `prepProgressPct` computed in JavaScript, because LLMs are unreliable at exactly that arithmetic. The model is left to prioritise and explain, which is what it is good at.

The provider lives behind **one file** (`groq.service.js`). Swapping models, changing providers, or adding streaming is a single-file change; nothing else in the codebase knows an LLM exists.

*Full detail: [Phase 3 §5](03-backend-deep-dive.md).*

---

## 11. Maintainability Decisions

**Uniformity as documentation.** Eleven modules, one shape. Learning one module teaches all of them. The consistency is worth more than any local optimisation a module might have made by deviating.

**Comments explain *why*, not *what*.** The codebase's most valuable comments record reasoning that would otherwise be lost:

> *"Refresh tokens are single-use (rotated) server-side, so the response also carries a NEW refresh token — persist BOTH or the next refresh will fail."*

> *"Deliberately excludes `image/svg+xml`: an SVG can carry embedded `<script>`."*

> *"Read the platform's own elapsed-time now, while the editor toolbar is still on screen."*

Each one prevents a future change from silently reintroducing a solved bug.

**Purity where it is cheap.** `journal.js` is I/O-free — Activity in, markdown out. The GitHub repository format can change without touching a line of network code, and the function is trivially testable.

**Single-owner modules.** One file owns encryption, one owns the LLM, one owns `chrome.storage`, one owns day-key formatting. Changing any of those means changing one file, and auditing them means reading one file.

**Configuration derived from one source.** In `build-extension.js`, `env.js`, the manifest's host permissions and match patterns, and the popup's links all derive from the same two variables — because they previously drifted, and a partial fix left the popup advertising a domain that was never deployed.

---

## 12. Known Technical Debt

Stated plainly, because an honest accounting is more useful than a clean one.

| Issue | Impact | Fix |
|---|---|---|
| **No automated tests** | CI verifies parse/build/containerise, not behaviour | Highest value: adapter tests against captured HTML fixtures; unit tests for `workload.service` and `dateStats` (pure functions, trivial to test) |
| **Attachments on ephemeral disk** | Files lost on every Render deploy; metadata orphaned in Mongo | Persistent disk, or object storage |
| **Single-instance schedulers** | Cannot scale horizontally | External queue or leader election |
| **Analytics computed per request** | Fine now; O(records) per call | Materialised daily rollups if volume grows |
| **DOM-coupled detection** | A judge's redesign breaks that adapter | Inherent to the problem; damage contained to one file |
| **Stale code comment** | `upload.middleware.js` says "no production deployment yet" — no longer true | One-line correction |

The first two are the ones that would matter to a reviewer. The rest are conscious trade-offs appropriate to current scale, documented so that the decision to revisit them is deliberate rather than forced.

---

## 13. Next

- **Phase 7 — End-to-End System Flows:** complete request/data journeys across every layer.
- **Phase 8 — Engineering Decisions & Insights:** the reasoning, trade-offs, challenges, and lessons behind the build.

---

*Momentum — Protect Your Progress.*
