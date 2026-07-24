# Momentum — Extension Engineering

**Phase 4 of the Momentum documentation series.**

The browser extension is the component that makes Momentum's core promise possible: *you never log anything.* It is also the hardest part of the system, because it runs inside web pages it does not own, under a runtime that can terminate it at any moment, against seven sites that change without notice.

This document covers how it detects a solve, how it survives being wrong, and how it delivers data reliably. **3,032 lines across 21 files.**

---

## 1. The Problem It Has to Solve

There is no API that tells you a user solved a problem. LeetCode does not emit an event. The only available signal is **the page changing in a way that means "accepted."**

That signal is genuinely hard to read:

- Each of the seven judges renders success differently — a green banner, a verdict table cell, a modal, a toast.
- These are heavy single-page applications: the DOM mutates constantly for reasons that have nothing to do with a submission.
- The word "Accepted" appears in places that are *not* a fresh success — submission history, a previously solved problem, a discussion thread.
- Navigating between problems does not reload the page, so there is no `load` event to anchor on.
- Getting it wrong in either direction is bad: a **missed** solve breaks the product's core promise, and a **false positive** poisons the analytics that everything else depends on.

Everything below is a response to some part of this.

---

## 2. Component Map

```
┌───────────────────────────────────────────────────────────────────┐
│              SERVICE WORKER  (background.js, 126 LOC)              │
│              central message router · sole network owner           │
│                                                                    │
│   importScripts (MV3 requires top-level, synchronous):             │
│     config/env.js → config/constants.js → utils/jwt.js             │
│     → storage/ → messaging/ → auth/oauth.js                        │
│     → logger.js → activityQueue.js → activityManager.js            │
│                                                                    │
│   ┌──────────────────┐  ┌───────────────┐  ┌──────────────────┐   │
│   │ activityManager  │  │ activityQueue │  │ oauth            │   │
│   │ 337 LOC          │  │ 79 LOC        │  │ chrome.identity  │   │
│   │ dedup · refresh  │  │ offline store │  │ dynamic redirect │   │
│   │ retry · backoff  │  │ bounded (50)  │  │                  │   │
│   └──────────────────┘  └───────────────┘  └──────────────────┘   │
└────────▲────────────────────▲───────────────────────▲─────────────┘
         │ PROBLEM_SOLVED     │ SYNC_AUTH             │ PERFORM_OAUTH
         │ FLUSH_QUEUE        │                       │ GET_STATUS
┌────────┴─────────┐  ┌───────┴────────┐   ┌──────────┴─────────┐
│ content-script.js│  │  content.js    │   │  popup.js          │
│ 792 LOC          │  │  212 LOC       │   │  139 LOC           │
│ on 7 judges      │  │  on Momentum   │   │  auth UI + status  │
│ DETECTION ENGINE │  │  site only     │   │                    │
└────────┬─────────┘  └────────────────┘   └────────────────────┘
         │ delegates site-specific questions to
┌────────▼──────────────────────────────────────────┐
│ providers/  — 7 adapters, 95–198 LOC each         │
│ leetcode · gfg · codeforces · hackerrank          │
│ codechef · atcoder · interviewbit                 │
└───────────────────────────────────────────────────┘
         │ built on
┌────────▼──────────────────────────────────────────┐
│ shared/dom-utils.js — visibility-aware DOM helpers │
└───────────────────────────────────────────────────┘
```

**Two content scripts, deliberately separate.** `content-script.js` runs on the seven judges at `document_idle` and detects solves. `content.js` runs *only* on the Momentum site at `document_start` and handles auth sync and presence announcement. Different targets, different jobs, different failure modes — merging them would mean shipping detection code to a page that never needs it.

---

## 3. The Detection Engine

`content-script.js` is the heart of the extension. Its central design decision:

> **The engine owns the strategy. The adapters own the site knowledge.**

The engine handles submit detection, mutation observation, debouncing, SPA navigation, cooldowns, retries, and duration measurement. It contains **no selectors and no site-specific strings**. Every site-specific question is delegated to an adapter.

### 3.1 The adapter contract

```js
{
  name:                 'LeetCode',        // display name
  hostMatch:            'leetcode',        // substring matched against hostname

  getProblemKey()                          // stable identity for this problem
  detectSolve(context)  → { solved, reason, signals }
  extractProblemData()  → { platform, problemTitle, url, solvedAt,
                            difficulty, language, … }
  isSubmitElement(el)   → bool             // is this the submit button?

  // Optional — the engine feature-detects each one
  isSubmitShortcut(evt) → bool             // e.g. Ctrl/Cmd+Enter
  mutationLooksRelevant(mutations) → bool  // site-specific mutation filter
  extractTimerSeconds() → number | null    // read the judge's own stopwatch
}
```

Optional methods are genuinely optional — only **LeetCode and GeeksforGeeks** implement `extractTimerSeconds`, because only those two display a stopwatch. The other five fall back to the engine's own measurement. Adding an eighth platform is one new file; the engine is untouched.

### 3.2 Two independent paths to detection

The engine will only consider a solve real if one of two conditions holds. This is the core of the false-positive defence.

```
                     ┌─────────────────────────────┐
                     │  Something happened on page │
                     └──────────────┬──────────────┘
                                    ▼
              ┌─────────────────────┴────────────────────┐
              ▼                                          ▼
   PATH A: Fresh submission                  PATH B: Strong signal
   ─────────────────────────                 ──────────────────────
   User clicked Submit / pressed             No submit seen, but the page
   Ctrl+Enter / submitted a form             shows an unambiguous accepted
   within the last 120 s,                    state AND a relevant mutation
   on THIS problem                           fired < 5 s ago
              │                                          │
              └────────────────────┬─────────────────────┘
                                   ▼
                     adapter.detectSolve(context)
                                   │
                          cooldown / in-flight checks
                                   ▼
                              send solve
```

**Path A — the submission window.** Clicking submit opens a 120-second window (`SUBMISSION_TIMEOUT_MS`) tied to a specific `problemKey`. Detection is only trusted inside it. This is what prevents "Accepted" text on a previously solved problem from registering a new solve — no submit, no window.

Submit is detected three ways, all with capture-phase listeners so the site's own handlers cannot swallow the event first:

```js
document.addEventListener('click',   …, true);   // adapter.isSubmitElement
document.addEventListener('submit',  …, true);   // native form submit
document.addEventListener('keydown', …, true);   // adapter.isSubmitShortcut
```

**Path B — the strong-signal fallback.** Path A misses a real case: the user submits, closes the laptop, and returns after the window expired. So a second path accepts detection *without* a submit — but only under strict conditions. It is **LeetCode-specific by design** (the fallback explicitly returns `false` for other platforms, because only LeetCode's result panel is structured enough to be read this confidently), and requires **five simultaneous signals**:

```
   "Accepted" text          ✓
   "N/N testcases passed"   ✓
   a visible Runtime panel  ✓
   a visible Memory panel   ✓
   a visible submission panel ✓
   ────────────────────────────
   AND a relevant mutation < 5 s ago
```

That last clause is the important one: a *static* page showing an old accepted result never triggers it, because nothing recently changed. The five-signal requirement plus recency is what makes an unsolicited detection safe.

### 3.3 Layered false-positive defence

```
  Layer 1  Startup quiet period   2.5 s — ignore everything on page load
  Layer 2  Path A or B required   no submit and no strong signal → stop
  Layer 3  Adapter confirmation   detectSolve() must agree
  Layer 4  Send cooldown          15 s per problemKey
  Layer 5  In-flight guard        sendInFlight blocks concurrent sends
  Layer 6  Worker-side dedup      in-memory + persisted, 30 s cooldown
  Layer 7  Server-side dedup      independent check in the API
```

Layer 1 exists because opening a problem you already solved renders "Accepted" immediately — without a quiet period, merely *visiting* a solved problem would log a solve.

Layers 6 and 7 are defence in depth for a specific failure: a request that **succeeds but whose response is lost**. A client-side check alone cannot catch that, because the client never learned it succeeded. The server checks independently, and returns `409` — which the extension treats as *success*, not failure.

### 3.4 Handling single-page navigation

Judges do not reload when you move between problems, so the engine watches for URL changes four ways: the MutationObserver, `popstate`, `hashchange`, and a 1-second poll. It also **monkey-patches `history.pushState` and `replaceState`**, since those change the URL without firing any event.

All four funnel into `checkUrlChange()`, and a change triggers a full reset: clear the submission window, clear the captured timer, clear all pending timers, and start a session for the new problem. Without this, a solve on problem B could inherit problem A's state.

### 3.5 Mutation filtering

`OBSERVER_OPTIONS` watches `childList`, `subtree`, `characterData`, and a **narrow attribute allowlist** (`class`, `data-e2e-locator`, `aria-label`, `role`) rather than all attributes — on a React app, watching every attribute means firing on every render.

Mutations are then filtered by relevance (`/accepted|runtime|memory|beats|testcases passed|submission/i`), adapters may add site-specific filters, and work is debounced through `scheduleReconcile()`. The observer fires constantly; the expensive path runs rarely.

### 3.6 Visibility-aware DOM reading

`shared/dom-utils.js` provides the primitive that makes detection trustworthy: **`isElementVisible()`**, checking `isConnected`, `display`, `visibility`, `opacity`, and a non-zero bounding box.

This matters because SPAs keep hidden nodes in the DOM. A plain `textContent` search would happily match "Accepted" inside a `display: none` panel from a previous submission. Every text read goes through `collectVisibleText()` or `findVisibleElementByText()`, so only what the user can actually see counts as evidence.

---

## 4. Measuring Real Solve Time

Momentum reports *"8m 27s"*, not *"about 10 minutes."* Three tiers, in order of preference:

**Tier 1 — the judge's own timer.** LeetCode and GFG display a stopwatch. The adapter reads it and the value is exact.

The subtlety is *when*. The timer is captured **at submit time**, not at detection time:

> *"Read the platform's own elapsed-time now, while the editor toolbar is still on screen — the submission result view may hide it moments later."*

By the time "Accepted" appears, the toolbar may be gone. Capturing at submit is the difference between a real number and none.

Parsing handles both shapes judges use — colon stopwatch (`1:05:00`, `3:45`) and letter format (`1h 15m 08s`, `2m 35s`).

**Tier 2 — persisted first-seen time.** When the problem is first opened, `firstSeenAt` is written to `chrome.storage.local` keyed by `problemKey`, with a **7-day TTL**. Persistence is what makes this survive a page reload or a terminated service worker — an in-memory timestamp would not.

**Tier 3 — wall clock.** Time since the content script loaded.

Tiers 2 and 3 are clamped to 1–180 minutes and flagged **`isEstimatedDuration: true`**, so the backend and UI can distinguish a measured duration from an inferred one. The system never pretends a guess is a measurement.

---

## 5. Reliable Delivery

Detection is only half the job. The service worker owns the other half.

### 5.1 The send pipeline

```
PROBLEM_SOLVED
   ▼ isDuplicate()        session set → persisted recentlySent (30 s)
   ▼ status: Syncing
   ▼ sendWithRetry()
        ├─ attempt 0..5, exponential backoff 2s→4s→8s→16s→32s (capped)
        ├─ 401  → refresh token once → retry
        ├─ 409  → treat as SUCCESS (server says it already has it)
        └─ 400/403/404/422 → PERMANENT, abort immediately
   ▼
 success → markAsSent · status Idle
 failure → enqueue to offline queue · status Offline
```

**Distinguishing permanent from transient failures is the key decision here.** A `400` means the payload is malformed — retrying it 5 times and then queueing it forever accomplishes nothing except burning battery and filling storage. Those are dropped immediately. Only genuinely transient failures (network, 5xx, timeout) earn a retry and a queue slot.

### 5.2 The offline queue

`activityQueue.js` persists failed activities to `chrome.storage.local` with `_queuedAt` and `_retries`, **bounded at 50 entries** with oldest-dropped eviction. Unbounded local storage in a browser extension is a real hazard; the cap makes worst-case footprint predictable.

Flushing is triggered four ways, because MV3 gives no single reliable moment:

| Trigger | Covers |
|---|---|
| Service-worker startup | Worker was terminated and respawned |
| `chrome.alarms`, every 5 min | Steady-state backstop (alarms wake a sleeping worker; `setInterval` does not) |
| `online` event in the worker | Connectivity restored while awake |
| `FLUSH_QUEUE` from a content script | Page saw `online` while the worker was asleep |

The last one exists precisely because a terminated service worker cannot observe anything — so a live page tells it.

Flushing iterates **backwards** (`for (let i = items.length - 1; i >= 0; i--)`) so removing an item cannot shift the index of one not yet processed.

### 5.3 Token refresh, and a bug worth naming

Momentum's refresh tokens are **single-use and rotated server-side** — every refresh returns a *new* refresh token. The extension must persist both:

```js
// Refresh tokens are single-use (rotated) server-side, so the response also
// carries a NEW refresh token — persist BOTH or the next refresh will fail
// with a now-invalidated token.
```

Storing only the access token would work exactly once and then log the user out permanently. Concurrent refreshes are collapsed through a shared `refreshPromise`, and the retry after a refresh passes `shouldRetryRefresh = false` so a persistently-401ing token cannot loop forever.

---

## 6. One-Login: Website → Extension

Asking a user to log in twice makes one product feel like two. `content.js` prevents that.

```
Website localStorage        content.js            service worker
   momentum-token   ───►  reads on load   ───►  SYNC_AUTH  ───►  chrome.storage
                     │                                              │
   API client posts  └──►  window message  ───►  SYNC_AUTH  ───►  updated
   MOMENTUM_AUTH_SYNC       listener                                │
                                                                    ▼
   logout → token: null ─────────────────────────────────►  clearAuthData()
```

It works in both directions and on both timings: an existing session is picked up when the extension is installed, and a fresh login propagates immediately. Logout propagates too — signing out on the site signs out the extension.

`content.js` also **wraps the page's `fetch` and `XMLHttpRequest`** to attach the auth header on Momentum API calls. This is a privileged position, and it comes with an obligation discussed in §8: it must never break the page it is a guest on.

### Presence detection — race-proof by construction

The website needs to know the extension is installed. The React app and the content script can mount in either order, so a one-shot announcement is a coin flip. The solution is two mechanisms:

1. **Synchronous announcement at `document_start`** — the DOM attribute is set unconditionally the instant the script runs, before any `await`:
   ```js
   announceStatus('installed');       // baseline, never gated on storage
   publishStatusAndHealth();          // async upgrade to 'connected'
   ```
2. **Answering `MOMENTUM_PING`** — if the page mounted late and missed the announcement, it can ask.

The baseline/upgrade split matters: `installed` is knowable synchronously, but `connected` requires an async storage read. Gating the whole announcement on that read would mean a slow storage call makes an installed extension look absent.

---

## 7. MV3 Constraints and How They Shaped the Code

Manifest V3 replaced the persistent background page with an **ephemeral service worker** that Chrome terminates when idle. Four consequences run through the codebase:

**1. `importScripts` must be top-level and synchronous.** A respawned worker re-runs the top of the file, so every dependency must load in a deterministic order before any handler fires.

**2. Memory is not storage.** Anything that must survive termination — tokens, the queue, `firstSeenAt`, sync status, `recentlySent` — lives in `chrome.storage.local`. In-memory structures like `sessionKeys` are treated strictly as a fast path in front of the durable copy, never as the record.

**3. `setInterval` cannot be trusted; `chrome.alarms` can.** A timer dies with the worker. An alarm wakes it. Hence a 5-minute alarm rather than an interval.

**4. Async message handlers must `return true`.** Otherwise the channel closes before `sendResponse` fires. Every async branch in the router does this deliberately — and `FLUSH_QUEUE`, which responds synchronously, deliberately returns `false`.

---

## 8. Failing Safely: The Orphaned Context

Reloading, updating, or reinstalling an extension **orphans the content scripts already injected into open tabs**. The page keeps running the code, but `chrome.runtime` is torn down. Every `chrome.*` call then throws:

```
TypeError: Cannot read properties of undefined (reading 'sendMessage')
Error: Extension context invalidated.
```

Nothing in the orphaned script can recover — only a page reload injects a live one. Before this was handled, two bad things happened:

- `content-script.js` caught the throw, scheduled a retry, threw again — **forever** — while the MutationObserver kept detecting solves that could never be reported.
- Worse, `content.js` wraps the *site's own* `fetch`. Its `chrome.storage` read rejected on an orphaned context, so **an orphaned script could break the Momentum website's API calls.** It also used `sendMessage().catch(…)`, which cannot catch a synchronous throw.

Both now guard every `chrome.*` entry point:

```js
function isExtensionAlive() {
  try { return Boolean(chrome?.runtime?.id); }
  catch { return false; }
}
```

`chrome.runtime.id` is `undefined` precisely when orphaned. In `content-script.js` a dead context triggers `shutdown()` — disconnect the observer, clear every timer, log **once**, stop. In `content.js` every entry point degrades to a no-op: no auth header is attached, and the page keeps working.

The guard is placed at the **funnel**, not just the leaves. An earlier fix guarded only `handleMutations`, but `checkUrlChange` is also reached from `popstate`, `hashchange`, and the URL poll — three routes still throwing. Guarding `checkUrlChange` itself covers all four.

The general principle, and the reason this matters more here than in ordinary code: **a content script is a guest in someone else's page.** When it cannot do its job, the only acceptable behaviour is to stop quietly.

---

## 9. Build and Distribution

`scripts/build-extension.js` handles the dev↔prod split, because an extension has no runtime environment variables — configuration must be **baked in at build time**.

```
extension/  (source, always localhost)
     │
     ▼  npm run build:ext:prod
   copy → dist-extension/
     │
     ├─ rewrite config/env.js          BACKEND_URL, FRONTEND_URL
     ├─ patch manifest.json            host_permissions + content_scripts.matches
     ├─ patch popup.html               link href AND visible link text
     │
     ▼  zip → momentum-sync-v1.0.0.zip
     └─ publish → frontend/public/downloads/momentum-sync-extension.zip
```

Publishing into `frontend/public/downloads/` means **the deployed Install page always serves the current build** — distribution is a side effect of the frontend deploy rather than a separate manual step.

All rewrites derive from the same two variables in the script, so `env.js`, the manifest, and the popup cannot drift apart. This was learned the hard way: the popup's `href` and its *visible text* were separate hardcoded strings, and an early fix patched only the href — leaving the UI showing a domain that was never deployed.

---

## 10. Security Posture

**Minimal permissions.** Only `identity`, `storage`, and `alarms`. No `tabs`, no `<all_urls>`, no `webRequest`. Host permissions are the seven judges plus the Momentum API — nothing else.

**Narrow injection.** Content scripts match specific path patterns (`https://leetcode.com/problems/*`), not entire domains, so the extension is absent from the rest of each site.

**No credentials in pages.** Tokens live in `chrome.storage.local`, reachable only by the service worker. Content scripts request auth via message passing; a compromised page cannot read the token store.

**OAuth without a registered extension ID.** `chrome.identity.getRedirectURL()` supplies the extension's own `https://<id>.chromiumapp.org/` callback at request time, and the backend validates it against `/^https:\/\/[a-p]{32}\.chromiumapp\.org\/?$/` before honouring it. This supports unpacked installs with changing IDs **without** turning the OAuth flow into an open redirect.

**Single storage owner.** `storage-service.js` is documented as the only module permitted to touch `chrome.storage.local` directly — one place to audit what is persisted.

---

## 11. Honest Limitations

- **Detection is DOM-coupled.** A judge redesigning its result panel can break its adapter. This is inherent to a product built on sites that expose no API; the mitigation is that damage is contained to one adapter file.
- **The strong-signal fallback is LeetCode-only.** Other platforms rely solely on the submission window, so a solve detected long after submit may be missed there.
- **Only two platforms yield exact timing.** The other five fall back to estimates — correctly flagged, but less precise.
- **`hostMatch` is a substring test.** Simple and adequate for these seven hosts, but not a strict origin check.
- **No automated tests.** Detection logic is verified manually against live sites. Given how much of the correctness lives in `detectSolve` and the layered guards, adapter-level tests against captured HTML fixtures would be the highest-value addition to this codebase.

---

## 12. Next

- **Phase 5 — Feature-Level Implementation:** every major feature end to end, and how they interlock.
- **Phase 6 — Technical Implementation:** layer-by-layer engineering decisions, shared primitives, security, and technical debt.
- **Phase 7 — End-to-End System Flows:** complete request/data journeys across every layer.
- **Phase 8 — Engineering Decisions & Insights:** the reasoning, trade-offs, challenges, and lessons behind the build.

---

*Momentum — Protect Your Progress.*
