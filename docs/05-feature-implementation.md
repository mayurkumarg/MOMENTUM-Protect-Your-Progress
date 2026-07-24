# Momentum — Feature-Level Implementation

**Phase 5 of the Momentum documentation series.**

Phases 1–4 covered the product vision, the system architecture, the backend internals, and the extension. This document walks the product **feature by feature**: what each one does, what problem it solves, how a user interacts with it, its complete flow, the data it handles, and how it connects to everything else.

Each feature is written to stand alone. Read only the section you need.

---

## Feature Map

```
   CAPTURE ─────────────► RECORD ─────────────► INTERPRET ────────► ACT
                                                                       
 ① Extension           ④ Activity Log       ⑥ Analytics        ⑨ Assistant
   auto-detection        (source of truth)     heatmap/streaks     grounded Q&A
                                                                       
 ② Manual logging      ⑤ Notes              ⑦ Workload         ⑩ Reminders
   for offline work      polymorphic           4-dimension        in-app + email
                                               classifier
 ③ Auth & One-Login                          ⑧ Coding Journal   ⑪ Tasks
   session everywhere                          GitHub portfolio    planning
                                                                  ⑫ Placements
                                                                    pipeline
                                                                  ⑬ Calendar
                                                                    unified time
```

Everything above the dotted line feeds **Activity** and **Task**, the two collections nearly every other feature reads from.

---

## ① Automatic Solve Detection (Browser Extension)

**The problem.** Manual practice logs die in about eleven days. Logging is a second, unrewarded task performed exactly when the user is most drained — right after cracking a hard problem. Any system that depends on the user's discipline to record their discipline will fail.

**What it does.** Watches seven judges — LeetCode, Codeforces, GeeksforGeeks, HackerRank, CodeChef, AtCoder, InterviewBit — and records each accepted submission automatically, with the real time spent.

**User interaction: none.** That is the entire point. Install once, sign in once, then just solve problems.

**Flow.**
```
User clicks Submit
   → content script opens a 120s submission window, captures the on-page timer
   → verdict turns Accepted; MutationObserver fires
   → adapter.detectSolve() confirms; adapter.extractProblemData() reads metadata
   → message to service worker → dedup → POST /api/dsa/activity
   → Activity stored → GitHub sync queued (fire-and-forget)
```

**Data captured.** Problem title, platform, URL, difficulty, language, `solvedAt`, `durationSeconds` (exact where available), `durationMinutes`, and `isEstimatedDuration`.

**Business logic worth knowing.** Detection requires either a **fresh submission** or **five simultaneous strong signals plus a recent mutation** — that dual gate is what stops "Accepted" text on an already-solved problem from logging a phantom solve. Duration prefers the judge's own stopwatch, read *at submit time* because the toolbar disappears once the result panel opens. Deduplication happens at three independent layers, and a server-side `409` is treated as success rather than failure.

**Connects to.** Everything downstream. Writes to **Activity**, which powers Analytics, Workload, the Coding Journal, and the Assistant's context.

*Full engineering detail: [Phase 4](04-extension-engineering.md).*

---

## ② Manual Activity Logging

**The problem.** Not all work happens on a judge. Reading a chapter, watching a lecture, revising notes, or solving on paper are real effort that automatic capture cannot see. If those never appear, the analytics quietly under-report the user's actual work.

**What it does.** Lets the user log any work session by hand.

**User interaction.** Activity page → "Log activity" → title, type, minutes, optional category, when it happened.

**Data.** Same `Activity` model as auto-capture, with `source: 'MANUAL'` and one of six types — `CODING`, `STUDY`, `ASSIGNMENT`, `PROJECT`, `REVISION`, `OTHER`. The `when` field is capped at the present, so activity cannot be logged into the future.

**Why it matters architecturally.** Manual and automatic entries share **one collection and one schema**. Analytics, streaks, and the workload engine read both without knowing or caring which is which — the `source` field exists for display and filtering, not for branching logic.

---

## ③ Authentication & One-Login

**The problem.** Two surfaces (website and extension) that each demand a login feel like two products. And a session that expires mid-study-session is worse than useless.

**What it does.** Email/password or GitHub sign-in, sessions that last up to 30 days, and an extension that inherits the website's session automatically.

**Flow — registration and login.**
```
Register (email/username/password)
   → password hashed with bcrypt
   → access token (15 min) + refresh token (30 days) issued IMMEDIATELY
   → user lands on the dashboard, already signed in
```
Registration issuing tokens matters: without it, a brand-new user is bounced to the login screen with a confusing "session expired" message.

**Flow — GitHub OAuth.** The same OAuth app serves three distinct jobs, disambiguated by the `state` parameter: signing in, linking GitHub to an existing email account, and authorising the extension. For in-session linking, a short-lived **signed link token** carries the user id so a caller cannot forge someone else's identity and attach their GitHub account to it.

**Flow — one-login sync.**
```
Website localStorage ──► content.js ──► SYNC_AUTH ──► extension storage
       (login, refresh, and logout all propagate automatically)
```

**Session longevity.** Access tokens are short-lived and renewed **before** they expire — the client refreshes 2 minutes ahead, and on tab focus, because background timers are throttled. Refresh tokens rotate on use and are stored only as SHA-256 hashes in a TTL-indexed collection. Rotation includes a **60-second grace window**, because the website and extension share one refresh token and would otherwise race, with the loser being silently logged out.

**Security.** Rate limiting on login (10/15min), registration (8/hr), refresh (30/15min) and OAuth start (20/15min); a refresh token is explicitly rejected if presented as an access token; and a token that decodes but fails backend verification signs the user out rather than leaving a half-authenticated ghost session.

---

## ④ Activity Log — The Source of Truth

**The problem.** Progress that lives in five places cannot be reasoned about.

**What it does.** One unified, filterable record of every unit of tracked work, regardless of origin.

**User interaction.** Browse chronologically, filter by source/type/date, log manually, edit or delete entries, and see connected sources at a glance.

**Data.** `source` (`DSA` | `MANUAL` | `GITHUB`), `activityType`, `title`, `durationMinutes` **and** `durationSeconds`, `isEstimatedDuration`, `activityDate`, `metadata` (platform, url, difficulty, language), and an embedded `githubSync` sub-document tracking publication state.

**The dual-duration decision.** Precise seconds and coarse minutes are both stored. Rounding at write time would be irreversible, so the precise value is preserved and display paths prefer it — which is why the UI can honestly say *"8m 27s"* instead of *"about 10 minutes."*

**Connects to.** This is the hub. Analytics, Workload, Coding Journal, Calendar, Overview, and the Assistant all read from it. Nothing else in the product has that reach.

---

## ⑤ Notes

**The problem.** Preparation generates scattered writing — an approach that worked, a company's interview pattern, a project idea — and it belongs *attached to the thing it is about*, not in a separate app.

**What it does.** Rich notes with checklists, tags, pinning, and file attachments, attachable to a task, a project, or a company.

**Unique implementation — polymorphic attachment.** Rather than `taskId`, the model uses `entityType` + `entityId`:

```js
NOTE_ENTITY_TYPE = { TASK, PROJECT, COMPANY }
```

One model, one service, one set of endpoints serving three surfaces. Adding a fourth attachable entity requires **no schema change**.

**Attachments — the most security-conscious code in the backend.** MIME **allowlist** (not a blocklist), 15 MB cap, one file per request, max 10 per note. Two decisions deserve highlighting:

- **`image/svg+xml` is deliberately excluded**, because an SVG can carry embedded `<script>` — a stored-XSS vector even when served as a download.
- **Filenames are randomised** with `crypto.randomBytes(16)`, so the user's original filename never touches a filesystem path. This eliminates path traversal outright rather than trying to sanitise it.

> ⚠️ **Known production gap.** Attachments are written to local disk. Render's filesystem is ephemeral, so uploaded files are lost on every deploy or restart while their metadata remains in MongoDB. Docker Compose handles this with a named volume; production needs a persistent disk or object storage. The code comment still says *"this project has no production deployment yet"* — a premise that is now false.

---

## ⑥ Analytics

**The problem.** "I've been consistent lately" is a feeling. Students systematically cannot self-assess during preparation, and the correction is real numbers.

**What it does.** Turns the raw activity log into an honest picture of consistency.

**User interaction.** Open the Analytics page — a GitHub-style contribution heatmap, current and longest streaks, this week vs. last week, platform and difficulty breakdowns, an 8-week productivity trend, and all-time task completion.

**Business logic.**
- **98-day window** — exactly fourteen weeks, a deliberate bound so the query never becomes an unlimited scan.
- **Streaks** computed from the set of distinct active days, both current and longest.
- **Weekly comparison** as a rolling 7-day vs. prior 7-day count, not calendar weeks — so the number means the same thing on a Tuesday as on a Sunday.

**Computed on read, not stored.** There are no denormalised counters. Every number is derived from raw activities at request time, supported by the `{ userId, activityDate: -1 }` compound index. At a single user's data volume this is fast, and it removes an entire class of bug where a cached aggregate silently disagrees with the records beneath it.

---

## ⑦ Workload Intelligence

**The problem.** "How much work do I have?" and "how soon is it due?" are different questions with different answers. A single stress score blurs them — twenty relaxed hours and four hours due tomorrow demand completely different responses.

**What it does.** Classifies the user's current state across **four independent dimensions**.

| Dimension | Values | Driven by |
|---|---|---|
| **Workload Level** | Low · Moderate · High | Total estimated hours, open task count |
| **Schedule Tightness** | Relaxed · Tight · Critical | Overdue count, due-within-3-days count |
| **Task Consistency** | Not Started · Needs Attention · Building · On Track | Current streak, active days in last 7 |
| **Overall Status** | Light · Balanced · Stretched · Overloaded | Synthesis of the first two |

**Thresholds** are constants at the top of the service: 8h/4 tasks → Moderate, 20h/8 tasks → High, 3-day due-soon horizon, 14-day lookback, 3-day streak target.

**Deliberately rule-based, not predictive.** The code says so explicitly. A student should be able to understand *why* they were told they are overloaded, and a transparent threshold can be argued with in a way a model score cannot.

**The kindest line of code in the product.** A brand-new user with no tasks and no activity is shown **"Not Started"**, never "Needs Attention":

> *"A brand-new (or entirely empty) workspace has nothing to measure yet — show a neutral 'Not Started' rather than scolding with 'Needs Attention'."*

**Connects to.** Reads Tasks (deadlines, `estimatedHours`, status) and Activity (recent days). Surfaces on Overview, and is injected into the Assistant's context so the AI reasons over the same classification the user sees.

---

## ⑧ Coding Journal (GitHub Portfolio)

**The problem.** Eight months of solving leaves nothing you own. The record lives inside LeetCode's walled garden — not portable, not presentable to a recruiter, not yours.

**What it does.** Commits every solved problem to the user's own GitHub repository, automatically, forever.

**User interaction.** Connect GitHub, then pick an existing repository or have Momentum create one — **inline on the Journal page**, no detour through Settings. After that, nothing. The user never writes a commit message.

**What gets written.**
```
your-repo/
├── README.md                          auto-generated summary table
├── momentum/index.json                machine-readable journal index
└── LeetCode/
    └── Medium/
        └── two-sum.md                 one file per problem
```
Each problem file records attempts, real solve time, platform, difficulty, and language. Solving the same problem again **appends a new attempt** rather than overwriting — the history is the point.

**Flow.**
```
Activity created (extension)
   → enqueueSync(userId, activityId)      fire-and-forget
   → per-user serial queue
   → decrypt GitHub token → read index → build markdown
   → commit problem file + index + README
   → activity.githubSync = { status, attempts, commitSha, filePath }
```

**Business logic worth knowing.**
- **Fire-and-forget by design.** The sync is *not* awaited by the request that created the activity. A slow GitHub API or a revoked token must never delay or fail the *capture* of work; publication is best-effort and self-healing.
- **Per-user serial queue.** Two solves seconds apart would race to update the same Git ref and lose a commit. Syncs are chained per `userId` — sequential within a user, parallel across users.
- **Bounded retries** with conflict and transient-error detection, capped attempts, and a 10-minute background sweeper that re-queues anything outstanding (which also catches activities orphaned by a server restart).
- **Sync state lives on the Activity itself.** There is no jobs table; the work item *is* the record.

**The dashboard.** The Journal page shows total synced, current/longest commit streak, this week vs. last week, recent commits, and a **"needs attention"** list of failed syncs with a one-click retry.

**Security.** GitHub access tokens are encrypted at rest with **AES-256-GCM** and decrypted only at call time.

---

## ⑨ AI Assistant

**The problem.** Users have questions their own data can answer — *"what should I work on today?"*, *"how am I doing this week?"* — but answering means cross-referencing five modules manually.

**What it does.** A conversational assistant that answers from the user's actual workspace.

**It is not RAG.** It is **Context-Augmented Generation** — no embeddings, no vector store, no similarity search. Seven deterministic MongoDB queries build a complete, bounded snapshot which becomes the system prompt.

The reasoning is worth stating plainly: RAG exists when knowledge exceeds the context window *and* you cannot predict what is relevant. Neither holds here — the location of every fact is known at development time, and one user's workspace serialises to a few kilobytes. Similarity search is probabilistic and can silently miss a relevant record; for *"what's due tomorrow?"* a miss is a correctness failure. A direct query cannot miss.

**Flow.**
```
Question → auth → rate limit (15/10min)
   → sanitize client-supplied history (≤12 messages, roles allowlisted)
   → build fresh context: workload · tasks · dsaToday · recentActivity
                          · analytics · github · placements   (parallel)
   → system prompt = persona + field guide + JSON snapshot
   → Groq (Llama 3.3 70B, temp 0.4)
   → grounded answer
```

**Design decisions that matter.**
- **Reuses existing services**, so the Assistant cannot contradict the dashboard.
- **Fails soft per section** — a broken GitHub call yields `null` for that section only, and the prompt instructs the model to read `null` as *"unavailable," not "zero."*
- **Every list is bounded** (15 tasks, 8 activities, 20 companies), so token cost is constant regardless of how much data a user has.
- **Derived fields pre-computed** — `daysUntilDeadline`, `overdue`, `prepProgressPct` — because LLMs are unreliable at date arithmetic.
- **Snapshot rebuilt every turn**, never carried in history, so answers reflect changes made mid-conversation.
- **Stateless server-side** — conversation history lives on the client; no chat logs are stored.
- A prompt rule forbids claiming to have taken an action, closing the failure mode where the model says *"I've added that to your list"* and the user believes it.

*Full implementation: [Phase 3 §5](03-backend-deep-dive.md).*

---

## ⑩ Reminders

**The problem.** A deadline you forget is the same as a deadline you missed.

**What it does.** Delivers reminders for task deadlines and placement events through two independent channels.

**User interaction.** Enable a reminder on a task or placement event, choose a preset offset (or a custom absolute time), and pick the channel in Settings: **In-app**, **Email**, or **Both** (the default).

**Two completely separate delivery paths.**

```
IN-APP  (frontend/src/hooks/useTaskReminders.js)
   mounted once at the app shell → fires on any page
   30s check · 3min task refresh
   toast + browser Notification (if permitted)
   marks reminder.notifiedAt

EMAIL   (backend/modules/notifications/reminder.scheduler.js)
   in-process interval, every 60s
   Nodemailer over Gmail SMTP
   marks reminder.emailSentAt
```

**The key design decision: two independent markers.** `notifiedAt` (in-app) and `emailSentAt` (email) are separate fields *specifically so the two channels can never race each other into suppressing one another.* If they shared one flag, whichever fired first would silence the other.

**Business logic.**
- `remindAt` is computed once on save (`deadline − offsetMinutes`, or an absolute value for custom reminders) and is the single field the checkers read.
- Email counts as sent **only after a successful send**, so a transient SMTP failure simply leaves it eligible next tick — that is the entire retry mechanism, no separate queue.
- A reminder more than **24 hours stale** is marked handled *without* sending, because a day-old reminder is noise, not help.
- The scheduler runs once at boot to catch anything that came due while the server was down.
- Email is skipped entirely if the user has no email address — which is the case for GitHub-only accounts.

**Honest limitation.** In-app reminders only fire while the app is open in a browser tab; they cannot wake a closed tab. That is exactly why the email channel exists, and why **Both** is the default.

---

## ⑪ Tasks & Task Workspace

**The problem.** Deadlines scattered across a phone, a notebook, and memory cannot be reasoned about — and cannot feed a workload calculation.

**What it does.** Deadline-driven task management with subtasks, tags, priority, reminders, and estimated effort.

**User interaction.** Create tasks with a deadline and estimated hours; filter and sort; break work down in the Task Workspace; attach notes; optionally link a task to a company in the Placement Tracker.

**Data.** `title`, `description`, `deadline`, `estimatedHours`, `priority` (LOW/MEDIUM/HIGH), `status` (PENDING/IN_PROGRESS/COMPLETED), `completedAt`, `subtasks[]`, `tags[]`, `category`, `reminder`, and an optional `companyId`.

**Business logic.** `completedAt` is maintained by a **pre-save hook**, not trusted from the client — set when status becomes `COMPLETED`, cleared on reopen. Analytics and the workload engine both depend on it, so it cannot be allowed to drift.

**`estimatedHours` is not decoration.** It is the primary input to the workload classifier. A task without an estimate is invisible to the "how much is on my plate" calculation.

**Connects to.** Workload (hours, deadlines, status) · Calendar (deadlines as events) · Overview (today/upcoming) · Placements (via `companyId`) · Notes (via polymorphic attachment) · Reminders · Analytics (completion rate) · Assistant (open and recently completed tasks).

---

## ⑫ Placement Tracker

**The problem.** Company applications live in a spreadsheet, interview dates in email, and prep notes somewhere else. For a placement-season student these are one project, fragmented across three tools.

**What it does.** A full pipeline for target companies, with dates, prep tasks, and notes attached to each.

**The pipeline.**
```
WISHLIST → PREPARING → APPLIED → OA_SCHEDULED → OA_COMPLETED
        → INTERVIEWING → SELECTED / REJECTED / WITHDRAWN
```

**User interaction.** Add a company with role, location, package, and resume version; move it through stages; add important dates (OA, interview rounds) each with its own reminder; link prep tasks; write notes on interview experience.

**Data.** `name`, `role`, `location`, `packageInfo`, `resumeVersion`, `applicationDate`, `status`, and `importantDates[]` — each date carrying its own reminder with the same dual `notifiedAt` / `emailSentAt` markers.

**Business logic worth knowing.** `computePlacementSummary` derives headline counts, and `applied` counts everything *past* Wishlist and Preparing rather than only the `APPLIED` status — because a company now at `INTERVIEWING` was obviously applied to. Prep progress is derived from linked tasks and is `null` (not `0`) when nothing is linked yet, so the UI and the Assistant can say *"no prep tasks linked"* instead of a misleading *"0% prepared."*

**Cross-feature integration.** This feature reaches further than any other: **Tasks** (linked prep work, auto-unlinked if the company is deleted), **Notes** (`entityType: COMPANY`), **Reminders** (per-event), **Calendar** (dates on the timeline), and the **Assistant** (companies, upcoming dates, prep progress, and note titles all enter the context).

---

## ⑬ Calendar

**The problem.** A submission deadline and an interview discovered separately is how conflicts happen.

**What it does.** Day, week, and month views of everything time-bound — task deadlines and tracked activity on one timeline.

**Unique implementation — zero new data fetching.** `useCalendarEvents` composes the *existing* `useTasks` and `useActivities` hooks, scoped to the visible range using the same `deadlineFrom/deadlineTo` and `dateFrom/dateTo` filters the Tasks and Activity pages already use:

```js
const tasksQuery = useTasks(taskParams)
const activitiesQuery = useActivities(activityParams)
// → normalizeEvents → groupEventsByDay
```

No calendar endpoint, no calendar collection, no sync logic. The calendar is a **view**, not a data source — which is why it can never drift out of sync with the pages it draws from.

**A thoughtful detail.** The overdue count is computed from *all* tasks, independent of the visible range — an overdue task from last month should still be flagged while you are looking at this month.

---

## ⑭ Overview Dashboard

**The problem.** The only question that matters on a given morning is *"what should I do today, and am I on track?"*

**What it does.** Composes six other features into a single answer.

**Sections.** Today Snapshot (tasks due today) · Workload Status · Recent Activity · Upcoming Tasks · Focus Next (the single highest-priority item) · today's coding summary · quick links.

**Design stance.** Every panel states plainly that it shows **only what already exists** in the user's records — *"Only what is already in your task and activity records."* No motivational filler, no invented urgency. Empty states are neutral: *"Today is clear unless you add something new."*

**Connects to.** Reads Tasks, Activity, Workload, Analytics, DSA summary, and extension status — six hooks composed into one screen. Owns no data of its own.

---

## ⑮ Settings, Install & Help

**Settings.** Profile (username, **editable email** — which matters for GitHub-only accounts that start with no email and therefore cannot receive reminders), reminder channel preference, extension connection status, and GitHub repository management. Email changes are rate-limited to 5/hour.

**Install.** A dedicated onboarding page for the extension. Chrome blocks web pages from linking to `chrome://extensions`, so instead of a dead link the page offers the address as **one-click copy** — a small friction removal that turns a confusing step into a paste.

**Help & Feedback.** Categorised feedback (bug/idea/question) routed to the developer, plus direct contact details.

**Theme.** Light, dark, or system, persisted to `localStorage` and applied before first paint.

---

## How the Features Interlock

```
                    ┌──────────────────────┐
        ┌──────────►│      ACTIVITY        │◄──────────┐
        │           │  (source of truth)   │           │
        │           └──────────┬───────────┘           │
   ① Extension                 │                  ② Manual log
   (auto)                      │                    (by hand)
                               │
        ┌──────────┬───────────┼───────────┬──────────────┐
        ▼          ▼           ▼           ▼              ▼
   ⑥ Analytics ⑦ Workload  ⑧ Journal   ⑬ Calendar    ⑨ Assistant
        │          │                                      ▲
        │          │                                      │
        └──────────┴──────────────┬───────────────────────┘
                                  │ reads everything
                    ┌─────────────┴──────────┐
                    │        TASKS           │◄──── ⑫ Placements (companyId)
                    │  deadlines · hours     │◄──── ⑤ Notes (polymorphic)
                    └────────────┬───────────┘
                                 │
                            ⑩ Reminders
                          (in-app + email)
```

**Three structural properties make this hold together:**

**One dataset, many lenses.** Analytics, Workload, the Journal, the Calendar, and the Assistant are all *views* over the same Activity and Task records. Nothing can drift out of sync with anything else because there is only one truth.

**Composition over duplication.** The Calendar reuses task and activity hooks. The Assistant reuses the workload and analytics services as direct function calls. Notes serve three entity types from one model. Adding a feature usually means composing existing pieces, not building parallel ones.

**Passive entry.** The loop starts with solving a problem — something the user was going to do anyway — rather than with "remember to log it." That single inversion is why the dataset stays complete when motivation dips, which is exactly when accurate data is most valuable.

---

## Feature Maturity — An Honest Assessment

| Feature | State | Notes |
|---|---|---|
| Extension capture | **Production** | 7 platforms; DOM-coupled by necessity |
| Auth & One-Login | **Production** | 30-day sessions, rotation with grace window |
| Activity, Tasks | **Production** | Core CRUD, well-indexed |
| Analytics, Workload | **Production** | Computed on read; bounded windows |
| Coding Journal | **Production** | Retries, per-user queue, self-healing |
| Assistant | **Production** | Requires `GROQ_API_KEY`; degrades cleanly without |
| Placements, Calendar | **Production** | Fully wired into tasks, notes, reminders |
| Reminders | **Production** | In-app cannot wake a closed tab — by design |
| Notes **attachments** | ⚠️ **At risk in prod** | Ephemeral filesystem on Render; needs persistent disk or object storage |

**Cross-cutting gaps**, stated plainly: there is **no automated test suite** (CI syntax-checks, builds, and containerises — it does not verify behaviour); the background schedulers assume a **single API instance** and would need an external queue or leader election to scale horizontally; and detection adapters are inherently coupled to seven third-party DOMs that can change without warning.

---

## Next

- **Phase 6 — Technical Implementation:** layer-by-layer engineering decisions, shared primitives, security, and technical debt.
- **Phase 7 — End-to-End System Flows:** complete request/data journeys across every layer.
- **Phase 8 — Engineering Decisions & Insights:** the reasoning, trade-offs, challenges, and lessons behind the build.

---

*Momentum — Protect Your Progress.*
