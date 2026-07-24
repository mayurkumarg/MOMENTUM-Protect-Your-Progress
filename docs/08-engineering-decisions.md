# Momentum — Engineering Decisions & Project Insights

**Phase 8 of the Momentum documentation series.**

Every previous phase described *what exists*. This one is about *why it exists that way* — the decisions, the alternatives rejected, the bugs that changed the design, and what the project taught.

Where possible, claims here are grounded in evidence: **50 commits spanning 3 May → 16 July 2026** (~10 weeks), the original blueprint document, and the code itself.

---

## 1. The Founding Constraint

Almost every decision in Momentum descends from a single observation:

> **Any system that requires the user's discipline to record their discipline will fail.**

Manual practice logs die in about eleven days. Logging is a second, unrewarded task performed at exactly the moment the user is most depleted — right after finally cracking a hard problem.

That constraint forces the hardest technical decision in the project: **capture must be passive**, which means a browser extension reading third-party DOMs, which means all of the complexity documented in Phase 4 — seven platform adapters, submission windows, mutation filtering, offline queueing, three-layer deduplication, MV3 lifecycle management.

An enormous amount of engineering exists to preserve one property: *the user does nothing.* Every time the design got harder, that constraint is why the harder path was taken.

---

## 2. Blueprint vs. Built

The original `MOMENTUM_BLUEPRINT.docx` proposed a three-layer model. Comparing it to what shipped is unusually instructive.

### What held exactly

The blueprint specified the workload engine's output shape:

```json
{ "workloadLevel": "High", "scheduleTightness": "Tight",
  "taskConsistency": "Needs Attention", "overloadStatus": "Overloaded" }
```

That is **byte-for-byte what `workload.service.js` returns today.** The three-layer model — *Planning → Activity → Workload* — also survived intact and is still visible in the module structure.

That fidelity is not luck. The blueprint specified a **contract** (the output shape) rather than an implementation, which left the thresholds, queries, and classification logic free to evolve without invalidating the design.

### What changed

The blueprint described three layers. The product shipped with **eleven backend modules**. Notes, the Placement Tracker, the Calendar, and the AI Assistant arrived in a single later commit (`5eb56f8`, +4,622 lines across 54 files) and were nowhere in the original plan.

They were not scope creep. They came from a realisation the blueprint hadn't reached: **for the target user, DSA practice and placement preparation are the same project.** A tracker that knows you solved 300 problems but not that you have an Amazon interview on Thursday is answering half the question.

**The lesson:** specify contracts early and features late. The parts of the blueprint that survived were the ones that defined *shape*; the parts that changed were the ones that guessed at scope.

---

## 3. The Decision Log

Each of these could have gone another way. The alternatives are real, not strawmen.

### 3.1 Browser extension over an API integration

**Chosen:** Chrome extension reading the DOM of seven judges.
**Alternative:** Poll platform APIs, or ask users to paste submission history.

LeetCode has no public submissions API. Codeforces has one; the others largely don't. A polling approach would have covered one platform, needed credentials, and still missed solve *duration* entirely.

**The trade:** accepted permanent coupling to seven third-party DOMs — a genuine maintenance liability — in exchange for the only implementation that satisfies the founding constraint. The mitigation is architectural: the adapter pattern confines a site redesign to one file.

### 3.2 Context-Augmented Generation over RAG

**Chosen:** Seven deterministic MongoDB queries → bounded JSON snapshot → system prompt.
**Alternative:** Embed user data, store vectors, retrieve by similarity.

RAG solves a specific problem: *knowledge exceeds the context window, and you cannot predict what's relevant until the question arrives.* **Neither condition holds here.** The location of every fact is known at development time (`tasks`, `activities`, `companies`), and one user's workspace serialises to a few kilobytes.

Worse, retrieval would actively degrade correctness. Similarity search is probabilistic and can silently miss a relevant record. For *"what's due tomorrow?"*, a miss is a correctness failure. A direct query cannot miss.

**The trade:** the design cannot answer over unbounded free text — note bodies and uploaded PDFs are deliberately excluded from context (only titles and counts enter). That is exactly the boundary where RAG would become the right tool, and the design accommodates it as an eighth context section.

> This is the decision most worth defending in an interview. *Choosing not to build RAG* is a stronger signal than having built it reflexively.

### 3.3 Computed reads over maintained counters

**Chosen:** Analytics and workload derived from raw records on every request.
**Alternative:** Denormalised counters updated on write.

Counters are faster and introduce a permanent correctness risk: a cached total that silently disagrees with the rows beneath it, discovered months later with no way to reconstruct the truth.

**The trade:** O(records in a 98-day window) per request, bounded and index-served — fast now, and a documented candidate for materialised rollups if volume grows. For a product whose entire value proposition is *"your data is honest,"* correctness over speed is the right ordering.

### 3.4 In-process schedulers over a queue system

**Chosen:** Two `setInterval` loops, idempotency via state on the record.
**Alternative:** Redis + BullMQ, or a managed queue.

A queue would add a datastore, a worker process, a dashboard, and a deployment target — for two jobs that run every 10 minutes and every 60 seconds.

**The trade, stated honestly:** this assumes a **single API instance**. Two instances would double-send reminders and their in-memory `userQueues` maps wouldn't coordinate. Horizontal scaling requires an external queue or leader election. That boundary is documented rather than hidden, and at current scale adding Redis would be infrastructure serving a hypothetical.

### 3.5 Four frontend dependencies

**Chosen:** `react`, `react-dom`, `react-router-dom`, `lucide-react`. Everything else built in.
**Alternative:** Redux/Zustand, React Query, MUI/shadcn.

`useAsyncData` is ~50 lines and provides what this app needs from React Query: `data`, `error`, `isLoading`, `isFetching`, `refetch`, with unmount safety.

**The trade:** no request deduplication, no background revalidation, no optimistic updates. Mutations refetch instead of patching a cache — an extra round-trip in exchange for *never* having a screen disagree with the server, and zero cache-invalidation logic to get wrong. For an app where one activity feeds five views, that guarantee is worth more than the latency.

### 3.6 Fire-and-forget GitHub sync

**Chosen:** `enqueueSync()` is not awaited by the request that created the activity.
**Alternative:** Await the commit, return a fully-synced result.

Awaiting would couple *capture* of work to *publication* of work. A revoked GitHub token or a slow API would then fail the user's solve record — losing the thing that matters to protect the thing that doesn't.

**The trade:** the user briefly sees an activity that isn't on GitHub yet, and needs a "needs attention" list plus retry for permanent failures. Both were built.

### 3.7 Feature modules over technical layers

**Chosen:** `modules/task/{routes,controller,service,model}`.
**Alternative:** `controllers/`, `services/`, `models/`.

Adding a field to a task touches one folder. In a layer-organised codebase, the same change spans four sibling directories, and reviewing it means holding four files in your head.

**The trade:** cross-cutting changes (like adding a field to every model) are more scattered. That is the rarer operation.

### 3.8 Storing both `durationSeconds` and `durationMinutes`

The precise value from the judge's own stopwatch, and the coarse rounded one.

Rounding at write time is **irreversible**. Storing both costs one integer per record and preserves the option. This is why the UI can honestly say *"8m 27s"* instead of *"about 10 minutes"* — and it took four iterations to get here (§4.2).

---

## 4. Challenges, and How They Were Solved

The commit history records the genuinely hard parts.

### 4.1 Detection reliability — three attempts at the same problem

```
2026-05-07  feat: Implemented Reliability Engine
2026-05-07  feat: Implemented Reliability Engine        ← again, same day
2026-05-08  feat: Reliability Engine (Fixed bug: detection and storing)
```

Three commits, two days, one title. Detecting "accepted" on a heavy SPA turned out to be substantially harder than it looks. The problems compounded:

- The word "Accepted" appears in submission history and on already-solved problems.
- SPA navigation means no `load` event to anchor on.
- React re-renders fire mutations constantly for unrelated reasons.
- Hidden DOM nodes from previous submissions still contain matching text.

**The eventual solution was layered rather than clever:** a 2.5-second startup quiet period, a 120-second submission window keyed to a specific problem, a five-signal fallback requiring a recent mutation, adapter confirmation, a 15-second cooldown, and visibility-aware DOM reading so hidden nodes never count as evidence.

**Lesson:** when a signal is inherently ambiguous, no single check will do. Reliability came from **composing several independently weak signals**, not from finding one strong one.

### 4.2 Solve duration — four iterations

```
"Track real per-problem solve time instead of hardcoded 1 minute"
"Read LeetCode's own solve timer, add difficulty/language capture"
"Fix real solve-time capture: LeetCode HH:MM:SS, GFG timer, submit-time read"
   … and later, a display-path fix where the timeline ignored durationSeconds
```

The progression is a miniature lesson in measurement:

1. **Hardcoded 1 minute** — a placeholder that was actively lying to the user.
2. **Wall-clock estimate** — real, but wrong whenever a tab sat open.
3. **Read the judge's own timer** — accurate, but initially read at the *wrong moment*.
4. **Read at submit time** — because the result panel hides the toolbar seconds later.

Step 4 is the non-obvious one, and it's now recorded as a comment in the code so it can't be undone by accident:

> *"Read the platform's own elapsed-time now, while the editor toolbar is still on screen — the submission result view may hide it moments later."*

**Lesson:** *when* you measure is often as important as *what* you measure.

### 4.3 The TTL index that deleted user accounts

The most serious bug in the project's history, fixed in `91e68cc`:

> *"Refresh tokens move to their own collection (hashed, per-token TTL) instead of an embedded array on User with a TTL index that was **silently deleting entire accounts** ~30 days after first login."*

A TTL index on a field inside an embedded array does not delete the array element — **it deletes the entire parent document.** Every user would have lost their account roughly 30 days after signing up, silently, with no error anywhere.

The fix was structural (separate collection, one document per token), and `config/db.js` *still* drops the legacy index defensively on every connect — because any database created before the fix carries the landmine.

**Lesson:** MongoDB TTL indexes operate on documents, never on array elements. More generally: a bug with a 30-day fuse and no error message will never be found by testing — only by reasoning about the mechanism.

### 4.4 The extension's silent refresh failure

Also from `91e68cc`:

> *"Fix the extension's self-refresh reading the wrong response field (and discarding the now-rotated refresh token), which silently broke background sync once the access token expired."*

The backend rotates refresh tokens on every use; the extension persisted only the access token. So the extension worked perfectly — **for exactly 15 minutes**, then permanently stopped syncing, with no visible error.

**Lesson:** when one side of a contract changes (single-use rotation), every consumer must change with it. The failure was silent because the extension had no user-facing surface to report it — which is why sync status is now persisted and displayed.

### 4.5 The deployment cluster

The final ten commits are almost entirely bug fixes, and they share a cause:

```
Fix build-extension.js placeholder URLs
Fix premature logout: attempt token refresh before signing out
Issue login tokens on registration instead of a token-less user
Keep sessions alive for the full refresh-token lifetime
Fail cleanly when the extension context is orphaned
Guard every orphaned-context path, not just the mutation one
```

**Local development had `JWT_EXPIRES_IN=7d`. Production set 15 minutes.** A one-week access token meant the entire class of expiry-related bugs was invisible for two months of development. Deploying with a *correct* production value exposed all of them within hours:

- `readInitialAuth()` deleted the 30-day refresh token whenever the 15-minute access token expired — so no session survived a reload.
- A watchdog signed users out on expiry without ever attempting a refresh.
- The web app and extension raced to redeem the same single-use refresh token; the loser was logged out mid-session.
- Registration returned no tokens, so new users were bounced to login with *"session expired."*

**Lesson, and the most transferable one in this document:** *lenient development configuration hides entire categories of bugs.* A 7-day token in dev wasn't a convenience — it was a blindfold. Development environments should differ from production in *credentials*, not in *behaviour*.

### 4.6 The orphaned extension context

Reloading an extension orphans content scripts already injected into open tabs — `chrome.runtime` is torn down while the script keeps running. Two failures resulted:

1. `content-script.js` caught the throw, scheduled a retry, threw again — **forever**, while the MutationObserver kept detecting solves that could never be reported.
2. Worse: `content.js` wraps the *website's own* `fetch`. Its storage read rejected on an orphaned context, so **an orphaned script could break the Momentum website's API calls.**

The first fix guarded `handleMutations` — and was incomplete, because `checkUrlChange` is also reached from `popstate`, `hashchange`, and a URL poll. Three routes still threw.

**Lesson:** guard the **funnel**, not the leaves. And: *a content script is a guest in someone else's page* — when it can't do its job, the only acceptable behaviour is to stop quietly.

### 4.7 Documentation entropy

```
"Consolidate root documentation, replace 25 stale status reports"
```

> *"The root had accumulated 25 overlapping AI-generated 'complete / production ready' status reports from past sessions, several with stale instructions (backend run command, extension file paths, wrong activity endpoint)."*

Twenty-five documents confidently describing a system that no longer existed. They were replaced with three canonical docs **verified against current code**.

**Lesson:** documentation that isn't verified against the code is worse than no documentation, because it's confidently wrong. This applies directly to *this* series — every claim in Phases 1–8 was checked against source, and several drafts were corrected mid-writing when they didn't survive that check.

---

## 5. Trade-offs Accepted Deliberately

| Accepted cost | Bought |
|---|---|
| DOM coupling to 7 judges | The only design that requires zero user effort |
| Extra round-trip on every mutation | UI that can never disagree with the server |
| Analytics recomputed per request | No cached aggregate can ever drift |
| Single-instance schedulers | No queue infrastructure to run or debug |
| No optimistic UI | No cache-invalidation logic to get wrong |
| Larger request bodies (client-held chat history) | Stateless assistant; no chat logs stored |
| 60s refresh-token grace window | Two clients can share a session without racing |
| Sequential GitHub syncs per user | No lost commits from concurrent ref updates |

Every row is a place where the *simpler-to-build* option was rejected for a *harder-to-break* one.

---

## 6. Scalability

**What scales fine today:** the API is stateless and horizontally scalable in principle; all queries are user-scoped and index-supported; analytics windows are bounded at 98 days; every context list has an explicit cap.

**What would break first, in order:**

1. **The schedulers.** Two API instances would double-send reminders. *Fix: leader election or an external queue.* This is the first real blocker to horizontal scaling.
2. **Per-request analytics.** O(records in window) is fine at hundreds of activities, not at hundreds of thousands. *Fix: materialised daily rollups.*
3. **Note attachments on local disk.** Already broken in production (§8).
4. **The per-user in-memory sync queue.** Doesn't coordinate across instances. *Fix: distributed lock.*

**The honest framing:** none of these are wrong for a single-user-per-account product with one API instance. They are documented so that revisiting them is a *deliberate decision* rather than an emergency.

---

## 7. Security Decisions Worth Explaining

**SHA-256 for refresh tokens, bcrypt for passwords.** Not an inconsistency. Bcrypt's slowness protects *low-entropy human-chosen* secrets from brute force. A signed JWT is already high-entropy — the expensive KDF buys nothing and adds latency to every refresh.

**Ownership in the query filter, not in a check.** Services query `{ _id: id, userId }` rather than fetching then comparing. A forgotten check becomes a 404, not a data leak — and it's one query instead of two. Combined with `userId` coming only from the verified token, **cross-tenant access is unexpressible**, not merely blocked.

**Error messages replaced by default.** Any error not deliberately thrown as an `AppError` has its message swapped for a generic string before responding. Driver internals, collection names, and index names never reach a client. Opt-in disclosure, not opt-out redaction.

**SVG excluded from uploads.** An SVG can carry embedded `<script>` — a stored-XSS vector even when served as a download. The reason is written in the code so nobody "helpfully" adds it back.

**Randomised upload filenames.** The user's original filename never touches a filesystem path, which eliminates path traversal outright rather than attempting to sanitise it. *Eliminating a class of bug beats defending against it.*

**The OAuth `linkToken` is separately signed.** The outer `state` is unsigned JSON, so without an independently signed token carrying the user id, a caller could forge `linkUserId` and attach their GitHub account to someone else's Momentum account.

**Extension redirects are regex-validated.** `chrome.identity.getRedirectURL()` supports unpacked extensions with changing IDs; validating against `/^https:\/\/[a-p]{32}\.chromiumapp\.org\/?$/` prevents that flexibility from becoming an open redirect.

---

## 8. Current Limitations

Stated plainly. An honest accounting is more useful than a clean one.

| Limitation | Severity | Notes |
|---|---|---|
| **Note attachments on ephemeral disk** | **High** | Render's filesystem resets on deploy; files vanish while metadata survives in Mongo. The code comment still claims *"no production deployment yet."* |
| **No automated tests** | **High** | CI verifies parse/build/containerise, not behaviour |
| Single-instance schedulers | Medium | Blocks horizontal scaling |
| DOM-coupled detection | Medium | Inherent; contained to one adapter file |
| Strong-signal fallback is LeetCode-only | Low | Other platforms rely on the submission window alone |
| Only 2 of 7 platforms give exact timing | Low | Others estimate, correctly flagged |
| In-app reminders can't wake a closed tab | Low | By design; email covers it |
| No mobile app | Low | Desktop is where the work happens |

---

## 9. Roadmap, as the Code Implies It

Not speculation — these are the extension points the architecture already anticipates.

**Immediate (production correctness).** Persistent storage for attachments; a test suite starting with the pure functions (`workload.service`, `dateStats`, `journal.js` — all trivially testable) and adapter tests against captured HTML fixtures.

**Near-term (the code is shaped for it).** More platforms — one adapter file each. More assistant context — the Placement Tracker was added by extending *one function*, exactly as the AI planning doc predicted. Chrome Web Store distribution, which the build pipeline already produces a package for.

**Longer-term (requires design work).** Leader election or an external queue to unblock horizontal scaling. Materialised analytics rollups. And **retrieval as an eighth context section** — the moment the assistant needs to answer over note *bodies* or uploaded PDFs, RAG stops being over-engineering and becomes the right tool. The prompt assembler and transport wouldn't change.

---

## 10. Lessons

**1. Constraints beat features.** *"The user does nothing"* generated more good architecture than any feature list would have. Every hard decision had a clear tiebreaker.

**2. Lenient dev config is a blindfold.** A 7-day access token in development hid an entire class of session bugs for two months. They all surfaced within hours of deploying with a correct 15-minute value. **Dev should differ from production in credentials, not behaviour.**

**3. Specify contracts, not implementations.** The blueprint's workload output shape shipped byte-for-byte. Its feature list didn't survive. Shape is durable; scope is a guess.

**4. Layer weak signals when no strong one exists.** Detection reliability came from composing seven imperfect checks, not from finding one perfect one. Three commits titled "Reliability Engine" are the evidence.

**5. Eliminate bug classes rather than defending against them.** Randomised filenames end path traversal. Ownership in the query filter ends cross-tenant leaks. `userId` from the token alone makes the attack unexpressible. Each beats a check that someone can forget.

**6. Guard the funnel, not the leaves.** The first orphaned-context fix covered one of four routes into the same code. Fixing the shared chokepoint covered all of them.

**7. Comments should record reasoning, not restate code.** The most valuable comments in this codebase — *"persist BOTH or the next refresh will fail"*, *"SVG can carry embedded `<script>`"*, *"read the timer while the toolbar is still on screen"* — each prevent a future change from silently reintroducing a solved bug.

**8. Unverified documentation is worse than none.** Twenty-five confident status reports described a system that no longer existed. Documentation must be checked against code, or it becomes an active liability.

**9. Precision is easier to keep than to recover.** Storing `durationSeconds` alongside `durationMinutes` costs one integer. Rounding at write time would have been permanent.

**10. Deploying is a test you cannot simulate.** Ten of the last commits are bugs that two months of local development never revealed. Production isn't the final step after building — it's an instrument that finds things nothing else will.

---

## 11. If This Were Rebuilt

- **Set production-realistic config from day one.** Short token lifetimes, strict secrets, real CORS. Most of the deployment-era bug cluster would never have existed.
- **Write the pure functions test-first.** `workload.service`, `dateStats`, and `journal.js` have no I/O and clear contracts. That's the cheapest possible coverage and it was skipped.
- **Choose object storage for uploads immediately.** The local-disk decision was reasonable when nothing was deployed, and became wrong the moment something was — silently.
- **Keep everything else.** The layered detection, the passive-capture constraint, the CAG-over-RAG call, the adapter pattern, the computed-reads model, and the four-dependency frontend all held up under real use.

---

## The Documentation Series

| Phase | Document |
|---|---|
| 1 | [Product Overview](01-product-overview.md) |
| 2 | [System Architecture](02-system-architecture.md) |
| 3 | [Backend Deep Dive](03-backend-deep-dive.md) |
| 4 | [Extension Engineering](04-extension-engineering.md) |
| 5 | [Feature Implementation](05-feature-implementation.md) |
| 6 | [Technical Implementation](06-technical-implementation.md) |
| 7 | [End-to-End Flows](07-end-to-end-flows.md) |
| 8 | **Engineering Decisions & Insights** — *this document* |

---

*Momentum — Protect Your Progress.*
