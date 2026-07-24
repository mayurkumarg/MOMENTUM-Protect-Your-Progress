# Momentum — End-to-End System Flows

**Phase 7 of the Momentum documentation series.**

Previous phases described the parts. This document traces the **journeys** — what actually happens, in order, across every layer, when a user does something real.

Each flow is a sequence you can follow from the first click to the final byte written. Where a flow can fail, the failure path is traced too.

---

## Notation

```
│   a participant's lifeline (frontend, API, DB, external service)
▼   time flowing downward
──► a call or message
◄── a response
⟳   a retry or loop
✗   a failure branch
```

---

## Flow 1 — Registration and First Sign-In

The shortest complete flow, and a good introduction to the request lifecycle.

```
User            React            API                     MongoDB
 │               │                │                        │
 │ fill form ───►│                │                        │
 │               │ validateRegistration()  (client-side)   │
 │               │                │                        │
 │               │ POST /api/auth/register                 │
 │               │───────────────►│                        │
 │               │                │ registerLimiter        │
 │               │                │   (8/hr per IP)        │
 │               │                │ validateRegisterInput()│
 │               │                │   email · username     │
 │               │                │   · password · match   │
 │               │                │                        │
 │               │                │ findByEmail() ────────►│
 │               │                │◄─── null (available)   │
 │               │                │ findOne({username}) ──►│
 │               │                │◄─── null (available)   │
 │               │                │                        │
 │               │                │ bcrypt.hash(pw, 10)    │
 │               │                │ createEmailUser() ────►│
 │               │                │◄─── user document      │
 │               │                │                        │
 │               │                │ signAccessToken(15m)   │
 │               │                │ signRefreshToken(30d)  │
 │               │                │ addRefreshToken() ────►│  SHA-256 hash
 │               │                │                        │  + TTL index
 │               │◄── 201 { token, refreshToken, user }    │
 │               │                │                        │
 │               │ setSession()                            │
 │               │   → localStorage: momentum-token        │
 │               │   → localStorage: momentum-refresh-token│
 │               │   → postMessage MOMENTUM_AUTH_SYNC ─────┼─► extension
 │               │   → navigate('/overview')               │
 │◄── dashboard ─│                                         │
```

**The critical detail** is that registration issues tokens. It once returned only the user object; the frontend called `setSession()`, found no token, interpreted that as an invalid session, and bounced the brand-new user to the login screen with *"Your session expired."* Registering **is** signing in — the flow now reflects that.

**Failure branches.**
```
✗ Validation fails      → 400 { errors: { email, username, … } }  field-keyed,
                           so the UI attaches messages to specific inputs
✗ Email/username taken  → 409  (or 11000 duplicate-key → 409 via errorMiddleware)
✗ Rate limited          → 429
```

---

## Flow 2 — The Authenticated Request Lifecycle

Every one of the 46 endpoints follows this. Understanding it once explains all of them.

```
Component          client.js              Express                  MongoDB
   │                  │                      │                        │
   │ useTasks() ─────►│                      │                        │
   │                  │ tokenProvider()      │                        │
   │                  │  → localStorage      │                        │
   │                  │                      │                        │
   │                  │ GET /api/tasks       │                        │
   │                  │ Authorization: Bearer│                        │
   │                  │─────────────────────►│                        │
   │                  │                      │ helmet                 │
   │                  │                      │ cors (allowlist)       │
   │                  │                      │ express.json (1MB)     │
   │                  │                      │ authMiddleware         │
   │                  │                      │   jwt.verify()         │
   │                  │                      │   reject type=refresh  │
   │                  │                      │   req.user={userId}    │
   │                  │                      │ controller             │
   │                  │                      │ service                │
   │                  │                      │   buildFilters(userId) │
   │                  │                      │   clamp limit ≤ 100    │
   │                  │                      │   find() ─────────────►│
   │                  │                      │◄──── documents         │
   │                  │                      │   serializeTask()      │
   │                  │◄── 200 {success,data}│                        │
   │                  │ unwrap .data         │                        │
   │◄── {tasks} ──────│                      │                        │
```

**Two invariants.** `userId` comes only from the verified token — a client has no way to *name* another user, so cross-tenant access is unexpressible, not merely blocked. And every response uses the same envelope, which is why one unwrapping rule serves the whole app.

### The 401 sub-flow — invisible token renewal

```
   │                  │ GET /api/tasks ─────►│ authMiddleware
   │                  │◄── 401 ──────────────│ (token expired)
   │                  │
   │                  │ refreshAccessToken()  ─── single-flight:
   │                  │                            concurrent 401s share
   │                  │                            ONE refresh promise
   │                  │ POST /api/auth/refresh ──►│
   │                  │                           │ verify refresh token
   │                  │                           │ findUserByRefreshToken()
   │                  │                           │ retireRefreshToken(60s grace)
   │                  │                           │ issue NEW pair
   │                  │◄── { token, refreshToken }│
   │                  │ storeToken() + storeRefreshToken()
   │                  │
   │                  │ RETRY original request (isRetry=true) ──►│
   │◄── {tasks} ──────│◄── 200
```

Three safeguards live in this small loop:

- **`isRetry` guard** — a token that 401s even when freshly minted cannot loop refresh → retry → refresh forever.
- **Only a genuine 401 ends the session.** A network failure returns `{ ok: false, unauthorized: false }` and leaves the session intact, so a brief connectivity drop doesn't log the user out.
- **The 60-second rotation grace window** exists because the website and extension share one refresh token and their access tokens expire together — both redeem at once, and strict single-use would log the loser out mid-session.

---

## Flow 3 — Automatic Solve Capture (the signature flow)

The longest and most important journey in the system, spanning a third-party page, a browser extension, the API, MongoDB, and GitHub.

```
LeetCode page      content-script      service worker       API            MongoDB      GitHub
     │                   │                   │               │                │           │
     │ user opens problem│                   │               │                │           │
     │──────────────────►│ ensureProblemSession()            │                │           │
     │                   │  → chrome.storage: firstSeenAt    │                │           │
     │                   │                   │               │                │           │
     │ [ 2.5s startup quiet period — ignore everything ]     │                │           │
     │                   │                   │               │                │           │
     │ user clicks Submit│                   │               │                │           │
     │──────────────────►│ markSubmissionStarted()           │                │           │
     │                   │  ├─ captureTimer()  ◄── reads the judge's OWN clock │           │
     │                   │  │   NOW, while the toolbar is still on screen      │           │
     │                   │  └─ open 120s window, keyed to this problemKey      │           │
     │                   │                   │               │                │           │
     │ verdict: Accepted │                   │               │                │           │
     │ (DOM mutates) ───►│ MutationObserver fires            │                │           │
     │                   │  ├─ mutationLooksRelevant()?      │                │           │
     │                   │  └─ scheduleReconcile() (debounced)                 │           │
     │                   │                   │               │                │           │
     │                   │ evaluateSolve()   │               │                │           │
     │                   │  ├─ PATH A: fresh submission?  ──┐│                │           │
     │                   │  ├─ PATH B: 5 strong signals +   ││                │           │
     │                   │  │           mutation <5s ago?  ──┤                │           │
     │                   │  │        (neither → STOP)        │                │           │
     │                   │  ├─ adapter.detectSolve() ✓       │                │           │
     │                   │  ├─ 15s cooldown? sendInFlight?   │                │           │
     │                   │  └─ adapter.extractProblemData()  │                │           │
     │                   │       title·platform·difficulty·language           │           │
     │                   │                   │               │                │           │
     │                   │ PROBLEM_SOLVED ──►│               │                │           │
     │                   │                   │ isDuplicate()?│                │           │
     │                   │                   │  ├ in-memory sessionKeys       │           │
     │                   │                   │  └ persisted recentlySent (30s)│           │
     │                   │                   │               │                │           │
     │                   │                   │ POST /api/dsa/activity         │           │
     │                   │                   │──────────────►│                │           │
     │                   │                   │               │ authMiddleware │           │
     │                   │                   │               │ SERVER-side    │           │
     │                   │                   │               │ dedup: same    │           │
     │                   │                   │               │ title+platform │           │
     │                   │                   │               │ same UTC day? ►│           │
     │                   │                   │               │ createActivity►│           │
     │                   │                   │◄── 201 ───────│                │           │
     │                   │                   │               │                │           │
     │                   │                   │  ┌─ FIRE-AND-FORGET, not awaited ──────────┐│
     │                   │                   │  │ enqueueSync(userId, activityId)         ││
     │                   │                   │  └──────────────────────────►│  (see Flow 4)│
     │                   │◄── {success} ─────│               │                │           │
     │                   │ clearProblemSession()             │                │           │
```

### Why the response doesn't wait for GitHub

Step 8b is deliberately **not awaited**. If it were, a slow GitHub API or a revoked token would delay — or fail — the *capture* of the user's work. Capture is the critical path and must stay fast and independent; publication is best-effort and self-healing.

### The three dedup layers, and why all three exist

| Layer | Catches |
|---|---|
| In-memory `sessionKeys` | Repeat sends within one service-worker lifetime |
| Persisted `recentlySent` (30s) | Repeats after the worker was terminated and respawned |
| **Server-side** (title + platform + UTC day) | **A request that succeeded but whose response was lost** |

That last row is the one a client can never handle alone — the client never learned it succeeded. The server returns **409**, and the extension treats 409 as *success*, because "the server already has it" is exactly the desired outcome.

### Failure branches

```
✗ No token          → NO_TOKEN, status Error, NOT queued (nothing to retry with)
✗ 401               → refresh once → retry → else fail
✗ 400/403/422/404   → PERMANENT: dropped immediately, never queued
✗ Network / 5xx     → ⟳ backoff 2s→4s→8s→16s→32s (5 attempts)
                       then → offline queue, status Offline
✗ Queue full (50)   → oldest entry evicted
```

Distinguishing permanent from transient is the key decision: retrying a malformed payload five times and then queueing it forever accomplishes nothing but burning battery and filling storage.

---

## Flow 4 — GitHub Journal Synchronisation

Triggered by Flow 3, running entirely in the background.

```
enqueueSync(userId, activityId)
        │
        ▼
┌───────────────────────────────────────────────────────┐
│ PER-USER SERIAL QUEUE                                 │
│   previous = userQueues.get(userId) || resolved       │
│   next = previous.then(task, task).catch(noop)        │
│                                                       │
│   → one user's syncs run STRICTLY SEQUENTIALLY        │
│   → different users run in PARALLEL                   │
│   (two solves seconds apart would otherwise race to   │
│    update the same Git ref and lose a commit)         │
└───────────────────────┬───────────────────────────────┘
                        ▼
                    runSync()
                        │
   ┌────────────────────┼─────────────────────────────┐
   ▼                    ▼                             ▼
 already 'synced'?   no integration?              proceed
 → return (no-op)    → status 'skipped'                │
                       + reason                        │
                                                       ▼
                        status='pending', attempts += 1
                                                       │
                        ┌──────────────────────────────┘
                        ▼
              decrypt GitHub token   ◄── AES-256-GCM, only at call time
                        │
                        ▼
        ┌───────── commitFiles() ── Git Data API ──────────┐
        │  READ:  getRef(branch) → base commit SHA         │
        │         getTreeShaForCommit()                    │
        │         readFile(problem.md), readFile(index.json)│
        │                                                  │
        │  BUILD: buildProblemMarkdown(activity, existing) │
        │         updateIndex(index, activity, path)       │
        │         buildReadme(index)                       │
        │                                                  │
        │  WRITE: createBlob() × 3                         │
        │         createTree(base_tree, entries)           │
        │         createCommit(tree, parent)               │
        │         updateRef(branch → new commit)           │
        └──────────────────────┬───────────────────────────┘
                               │
              ┌────────────────┴─────────────────┐
              ▼                                  ▼
      ref updated ✓                     ✗ 409 conflict / transient
   status = 'synced'                    ⟳ retry whole read-modify-write
   + commitSha + filePath                  (max 3 attempts)
                                          else status='failed' + error
```

### Three decisions worth naming

**Git Data API, not the Contents API.** The Contents API writes one file per commit — three files would mean three commits per solve. Blob → tree → commit → ref produces **one atomic commit** containing the problem file, the index, and the README together.

**The whole read-modify-write cycle retries, not just the write.** If the branch moved between the read and the write (another sync, or a manual push), the base tree is stale — replaying only the write would clobber. Re-reading first is what makes the retry correct.

**Sync state lives on the Activity.** There is no jobs table; `githubSync: { status, attempts, lastAttemptAt, commitSha, filePath, error }` is embedded on the record. Recovery is therefore one query.

### The backstop sweeper

```
every 10 min (and once at boot):
   requeueOutstanding()
      ├─ status 'failed' AND attempts < 5     → re-queue
      └─ status 'pending' AND stuck > 3 min   → re-queue
                                                (likely orphaned by a restart)
```

Running at boot is what recovers activities left mid-flight when the process died.

---

## Flow 5 — GitHub OAuth (three journeys, one endpoint)

The same OAuth app serves login, in-session linking, and extension auth — disambiguated by the `state` parameter.

```
                          ┌──────────────────────────────┐
                          │  state = JSON {              │
                          │    source: 'web'|'extension' │
                          │    returnTo: '/path'         │
                          │    linkToken: <signed JWT>   │  ← separately signed
                          │    extRedirect: <chromiumapp>│  ← regex-validated
                          │  }                           │
                          └──────────────────────────────┘

Browser/Extension       API                    GitHub              MongoDB
      │                  │                       │                    │
      │ GET /api/auth/github?source=…            │                    │
      │─────────────────►│ oauthStartLimiter     │                    │
      │                  │ build state           │                    │
      │◄── 302 ──────────│                       │                    │
      │──────────────────┼──────────────────────►│ user authorises    │
      │◄─────────────────┼── 302 ?code=…&state=… │                    │
      │                  │                       │                    │
      │ GET /api/auth/github/callback            │                    │
      │─────────────────►│ parseOAuthState()     │                    │
      │                  │  ├ verify linkToken ──┼── forged linkUserId│
      │                  │  │                    │   is impossible    │
      │                  │  └ sanitize extRedirect (open-redirect guard)
      │                  │                       │                    │
      │                  │ exchangeCodeForToken ►│                    │
      │                  │◄── access_token ──────│                    │
      │                  │ getGithubUser() ─────►│                    │
      │                  │◄── profile ───────────│                    │
      │                  │                       │                    │
      │                  │ encrypt(token) AES-256-GCM ───────────────►│
      │                  │                       │                    │
   ┌──┴───────────────────────────────────────────────────────────────┴──┐
   │                        THREE OUTCOMES                               │
   ├─────────────────────────────────────────────────────────────────────┤
   │ A. LINK (linkUserId present)                                        │
   │    existing session untouched, NO new tokens issued                 │
   │    → redirect {returnTo}?github=connected                           │
   │                                                                     │
   │ B. WEB LOGIN                                                        │
   │    find-or-create user by githubId → issue token pair               │
   │    → redirect {returnTo}?token=…&refreshToken=…                     │
   │      (the redirect URL is deliberately never logged — it carries    │
   │       both tokens as query params)                                  │
   │                                                                     │
   │ C. EXTENSION                                                        │
   │    → redirect https://<id>.chromiumapp.org/?token=…                 │
   │      chrome.identity closes the window and hands back the URL       │
   └─────────────────────────────────────────────────────────────────────┘
```

**Why `linkToken` is signed separately.** The outer `state` is unsigned JSON. Without an independently signed token carrying the user id, a caller could hand-craft `linkUserId` and attach *their* GitHub account to *someone else's* Momentum account.

**The link case issues no tokens.** The user already has a valid session; minting a new one would silently replace it. This is what makes "connect GitHub from Settings" safe for an already-signed-in user.

---

## Flow 6 — One-Login Propagation

How a website session becomes an extension session, with no second login.

```
Momentum site        content.js        service worker       chrome.storage
     │                   │                   │                   │
   ── CASE 1: extension installed while already signed in ──
     │                   │                   │                   │
     │  page loads       │ read localStorage │                   │
     │──────────────────►│  momentum-token   │                   │
     │                   │ SYNC_AUTH ───────►│ decodeJWT(token)  │
     │                   │                   │ setAuthData() ───►│
     │                   │                   │                   │
   ── CASE 2: user logs in while extension is installed ──
     │                   │                   │                   │
     │ storeToken()      │                   │                   │
     │  postMessage      │                   │                   │
     │  MOMENTUM_AUTH_SYNC──► listener       │                   │
     │                   │ SYNC_AUTH ───────►│ setAuthData() ───►│
     │                   │                   │                   │
   ── CASE 3: logout ──
     │ clearStoredAuth() │                   │                   │
     │  token: null ────►│ SYNC_AUTH(null) ─►│ clearAuthData()──►│
```

**Presence detection runs the other direction**, and must be race-proof because the React app and the content script can mount in either order:

```
content.js at document_start:
   announceStatus('installed')        ← SYNCHRONOUS, before any await
   publishStatusAndHealth()           ← async upgrade to 'connected'

website (useExtension):
   read data-momentum-extension-status
   if absent → postMessage MOMENTUM_PING  ⟳ up to 5×, 400ms apart
                    │
   content.js ──────┘ answers with a fresh publishStatusAndHealth()
```

The baseline/upgrade split matters: `installed` is knowable synchronously, `connected` needs an async storage read. Gating the whole announcement on that read would make a slow storage call look like an absent extension.

---

## Flow 7 — AI Assistant Request

```
User            React           API                 Services/DB          Groq
 │               │               │                       │                │
 │ "what should I work on?"      │                       │                │
 │──────────────►│               │                       │                │
 │               │ POST /api/assistant/chat              │                │
 │               │  { messages: [...full recent history] }│                │
 │               │──────────────►│ authMiddleware        │                │
 │               │               │ assistantLimiter      │                │
 │               │               │   15/10min ← real $$  │                │
 │               │               │                       │                │
 │               │               │ sanitizeMessages()    │                │
 │               │               │  ├ roles allowlisted  │                │
 │               │               │  ├ ≤8000 chars each   │                │
 │               │               │  ├ keep last 12       │                │
 │               │               │  └ LAST must be user  │ ← blocks a client
 │               │               │                       │   forging an
 │               │               │                       │   assistant turn
 │               │               │ buildUserContext()    │                │
 │               │               │  Promise.all, each safe():             │
 │               │               │   ├ workloadService ─►│ (direct call,  │
 │               │               │   ├ analyticsService ►│  not HTTP)     │
 │               │               │   ├ Task.find() ─────►│                │
 │               │               │   ├ Activity (today) ►│                │
 │               │               │   ├ Activity (recent)►│                │
 │               │               │   ├ githubService ───►│                │
 │               │               │   └ companyService ──►│                │
 │               │               │                       │                │
 │               │               │  ✗ any ONE fails → that section = null │
 │               │               │    (others still returned)             │
 │               │               │                       │                │
 │               │               │ buildSystemPrompt()   │                │
 │               │               │  PERSONA + FIELD GUIDE + JSON snapshot │
 │               │               │                       │                │
 │               │               │ createChatCompletion()─────────────────►│
 │               │               │  [system, ...≤12 history]   Llama 3.3 70B
 │               │               │                        temp 0.4 · 1024 tok
 │               │               │◄────────────────────────────────────────│
 │               │◄── { reply, model }                   │                │
 │◄── rendered ──│                                       │                │
```

### Why the context is rebuilt every single turn

The snapshot is **never carried forward in conversation history**. Ask *"what's due today?"*, complete a task, ask again — the second answer reflects the change. A cached snapshot would confidently report stale state, which is worse than refusing to answer.

### Failure mapping

```
✗ no GROQ_API_KEY  → 503 "not configured yet"
✗ timeout (30s)    → 504 "took too long to respond"
✗ provider 401     → 502 "credentials are invalid"
✗ provider 429     → 429 "rate-limited right now"
✗ empty completion → 502 "returned an empty response"
✗ anything else    → 502 generic  (real error logged server-side only)
```

A separate `GET /api/assistant/status` lets the UI discover configuration *before* the user types, so an unconfigured deployment shows a clear state instead of failing on first use.

---

## Flow 8 — Analytics Generation

```
User opens /analytics
     │
     ▼
useAnalyticsSummary() → GET /api/analytics/summary
     │
     ▼
computeAnalyticsSummary(userId)
     │
     ├── Promise.all ──┬─► Activity.find({ userId, activityDate ≥ 98d ago })
     │                 │      served by { userId:1, activityDate:-1 }
     │                 └─► Task.find({ userId }).select('status deadline')
     │
     ▼
  IN-MEMORY COMPUTATION (no aggregation pipeline)
     │
     ├─ countsByDay:  Map<formatDateKey(date), count>
     │
     ├─ heatmap:      98 cells, zero-filled for empty days
     │                 (the UI needs a continuous grid, not sparse data)
     │
     ├─ streaks:      computeCurrentStreakDays(dayKeys)
     │                computeLongestStreakDays(dayKeys, 98)
     │                  ← both key off the SAME formatDateKey() as the heatmap,
     │                    so they can never disagree by a day
     │
     ├─ weekly:       rolling 7d vs prior 7d  (not calendar weeks — the number
     │                means the same thing on a Tuesday as on a Sunday)
     │
     └─ breakdowns:   platform · difficulty · task completion
     │
     ▼
  { range, heatmap, streak, weeklyComparison, platformBreakdown, … }
```

**Computed on read, never stored.** No counters, no rollups, no reconciliation job — and therefore no possibility of a cached total disagreeing with the records beneath it. The cost is O(records in a 98-day window) per request, bounded and index-served.

**The Assistant reuses this exact function** but strips the 98-cell heatmap before injecting it — the model needs headline signals, not per-day granularity.

---

## Flow 9 — Reminders (two independent channels)

```
                    Task saved with reminder.enabled
                                │
                    pre-save: remindAt = deadline − offsetMinutes
                              (or an absolute value if custom)
                                │
        ┌───────────────────────┴────────────────────────┐
        ▼                                                ▼
  IN-APP CHANNEL (client)                     EMAIL CHANNEL (server)
  useTaskReminders()                          reminder.scheduler.js
  mounted once at AppShell                    in-process interval
        │                                            │
   every 30s:                                   every 60s:
     for each task:                               Task.find({
       enabled? remindAt ≤ now?                     'reminder.enabled': true,
       not COMPLETED?                               'reminder.remindAt': ≤ now,
       notifiedAt empty?                            'reminder.emailSentAt': null
         │                                        })
         ▼                                            │
     toast.info(...)                             user.email exists?
     + Notification (if permitted)                channel EMAIL or BOTH?
         │                                            │
         ▼                                            ▼
     PATCH task → notifiedAt = now            remindAt older than 24h?
                                               → mark handled, DON'T send
                                                  (a day-old reminder is noise)
                                                    │
                                                    ▼
                                              Nodemailer → Gmail SMTP
                                                    │
                                          ✗ send fails → leave emailSentAt null
                                                          → naturally retried
                                                            next tick
                                                    │
                                                    ▼
                                              emailSentAt = now
```

**The single most important detail: `notifiedAt` and `emailSentAt` are separate fields.** If the two channels shared one flag, whichever fired first would permanently suppress the other. Separating them is what allows **Both** to be the default.

**Retry without a retry mechanism.** Email counts as sent only *after* a successful send, so a transient SMTP failure simply leaves the row eligible on the next 60-second tick. There is no queue, no dead-letter table, no backoff schedule — the query *is* the retry.

**Honest limitation.** The in-app channel only fires while a tab is open; it cannot wake a closed browser. That is precisely why the email channel exists.

---

## Flow 10 — Application Boot and Shutdown

```
BOOT
  node backend/server.js
     │
     ▼ validateEnv()            5 required vars; secrets ≥32 chars
     │                          → PRODUCTION: throw and exit
     │                          → DEV: warn and continue
     ▼ connectDB()              refuse to serve without a database
     │   └─ drop legacy refreshTokens.expiresAt_1 index (defensive, no-op now)
     ▼ startSyncScheduler()     immediate requeueOutstanding() ← recovers work
     │                          then every 10 min                 orphaned by
     ▼ startReminderScheduler() immediate tick ← catches reminders  the last
     │                          then every 60s   that came due       shutdown
     │                                           while down
     ▼ app.listen(PORT)
     │
     ▼ register SIGTERM / SIGINT handlers

SHUTDOWN  (Render sends SIGTERM on deploy)
     │
     ▼ server.close()           stop accepting new connections,
     │                          let in-flight requests finish
     ▼ mongoose.connection.close()
     ▼ process.exit(0)
```

**Both schedulers run once at boot before entering their interval.** That single line is what makes the system self-healing across restarts: any activity left `pending` and any reminder that came due during the downtime is picked up on the next start.

---

## Flow 11 — Frontend Session Restoration

What happens on a cold page load, and why it used to be broken.

```
Browser refresh / app restart
     │
     ▼ AuthProvider mounts, status = 'loading'
     │
     ▼ readInitialAuth()
     │   ├─ token in URL? (OAuth return) → store it, strip from URL via replaceState
     │   └─ read localStorage
     │
     ├─────────────────────────────────────────────────────────┐
     ▼                        ▼                                ▼
 access token VALID    access token EXPIRED             no valid tokens
     │                  but refresh token VALID              │
     │                        │                              ▼
     │                        ▼                        clearStoredAuth()
     │                  needsRefresh = true            → /login
     │                        │
     │                        ▼
     │                  refreshSession()
     │                    ✗ 401 → signOut('expired')
     │                    ✗ network → unauthenticated, tokens KEPT
     │                        │
     └────────────┬───────────┘
                  ▼
            GET /api/auth/me
                  │
     ┌────────────┼─────────────────────┐
     ▼            ▼                     ▼
  200 OK      401 / 404             network error
  full user   signOut('invalid')    unauthenticated,
  → authenticated                    tokens KEPT for retry
```

**The bug this flow was rewritten to fix:** `readInitialAuth()` used to call `clearStoredAuth()` whenever the *access* token was expired — deleting the still-valid 30-day refresh token alongside it. Every reload after the first 15 minutes therefore discarded a live session. Distinguishing "access token expired" (recoverable) from "no valid credentials" (genuinely over) is what makes sessions survive restarts.

**A second, subtler fix:** a network error no longer destroys stored tokens. Only an explicit `401`/`404` — the server actively rejecting the credential — ends a session.

---

## Flow 12 — Error Propagation, End to End

```
   THROW SITE                     TRANSFORMATION                  USER SEES
   ──────────                     ──────────────                  ─────────

   service throws                 errorMiddleware:
   AppError('Email already        isOperational = true
   registered', 409)         ──►  → message passed through   ──►  "Email already
                                                                   registered"

   Mongoose ValidationError  ──►  → 400, message passed      ──►  field message

   Mongoose CastError        ──►  → 400 "Invalid {path}"     ──►  "Invalid id"

   duplicate key 11000       ──►  → 409, field named         ──►  "That email is
                                                                   already in use"

   TypeError (a real bug)    ──►  isOperational = falsy
                                  → logged FULLY server-side
                                  → message REPLACED         ──►  "Internal
                                                                   server error."
                                                                  ↑ driver details,
                                                                    collection names,
                                                                    index names never
                                                                    reach the client
```

**Client side**, `client.js` normalises everything into an `ApiError` carrying `status`, including the offline case:

```
fetch() itself throws (TypeError)
   → "Momentum couldn't reach the server. Check your connection and try again."
```

Which then surfaces through the shared `ErrorState` primitive, so every screen presents failure the same way — with a retry action.

**Error handling by layer:**

| Layer | Posture |
|---|---|
| Content script | Never break the host page — degrade to no-op |
| Service worker | Classify permanent vs transient; queue only what's retryable |
| API | Operational errors pass through; unexpected ones are sanitised |
| Background workers | Failures recorded on the record, retried by the sweeper |
| Assistant context | Per-section fail-soft — `null` means *unavailable*, not *zero* |
| Frontend | `ErrorBoundary` for renders, `ErrorState` for data, toasts for actions |

---

## Cross-Flow Summary

```
                    ┌──────────────────────────────────┐
                    │  ONE ACTION: user solves a problem│
                    └────────────────┬─────────────────┘
                                     │
        ┌────────────────────────────┼──────────────────────────┐
        ▼                            ▼                          ▼
   Flow 3: capture            Flow 4: GitHub sync        Flow 8: analytics
   (extension → API → DB)     (background, async)        (next page load)
        │                            │                          │
        │                            ▼                          ▼
        │                     commit in user's repo      heatmap + streak
        │                                                       │
        ▼                                                       ▼
   Activity record ──────────────────────────────────► Flow 7: Assistant
   (single source of truth)                            answers from it
```

**Three properties make the whole system coherent:**

**One write, many readers.** A single Activity record fans out to the journal, the analytics, the workload classifier, the calendar, and the AI context. Nothing is written twice, so nothing can disagree.

**The critical path is short; everything expensive is deferred.** The extension's request returns as soon as the activity is stored. GitHub commits, analytics computation, and reminder dispatch all happen outside it.

**Failure is contained, never cascading.** GitHub can be down, the LLM unconfigured, and SMTP broken — and a user can still sign in, solve problems, have them captured, and see their analytics. Every external dependency except the database is non-fatal by construction.

---

## The Documentation Series

| Phase | Document | Covers |
|---|---|---|
| 1 | [Product Overview](01-product-overview.md) | Vision, problem, users, journey |
| 2 | [System Architecture](02-system-architecture.md) | Surfaces, layers, deployment shape |
| 3 | [Backend Deep Dive](03-backend-deep-dive.md) | Modules, data model, the AI implementation |
| 4 | [Extension Engineering](04-extension-engineering.md) | Detection, adapters, offline queue, MV3 |
| 5 | [Feature Implementation](05-feature-implementation.md) | All 15 features end to end |
| 6 | [Technical Implementation](06-technical-implementation.md) | Engineering decisions, primitives, tech debt |
| 7 | **End-to-End Flows** | *This document — how it all runs* |
| 8 | [Engineering Decisions](08-engineering-decisions.md) | Reasoning, trade-offs, challenges, lessons |

---

*Momentum — Protect Your Progress.*
