# Testing

No automated test suite exists yet — verification is manual. This covers auth flows and the 7 platform detectors.

## Auth endpoints

```
POST /api/auth/register        (public)
POST /api/auth/login           (public)
POST /api/auth/logout          (auth required)
GET  /api/auth/github          (public, redirects to GitHub)
GET  /api/auth/github/callback (public)
POST /api/auth/refresh         (public)
GET  /api/auth/me              (auth required)
```

Login/register responses return `{ token, refreshToken, user }` — the field is `token`, not `accessToken`.

## Manual auth test flow

1. Register at `/register`, then log in at `/login`.
2. Log in with GitHub via the OAuth button.
3. Refresh the page — session should persist (tokens live in localStorage as `momentum-token` / `momentum-refresh-token`).
4. Log out from the profile menu or Settings — should clear the session and redirect.
5. Hit a protected route while logged out (`/overview`, `/tasks`, `/activity`, `/timeline`, `/analytics`, `/assistant`, `/settings`) — should redirect to `/login`.
6. Log in on the web app with the extension installed — the extension should pick up the session automatically via the `MOMENTUM_AUTH_SYNC` postMessage (check the extension popup shows you as logged in without clicking its own login button).

## Platform detectors

The extension posts detected solves to **`POST /api/dsa/activity`** (not `/api/activities` — that's a separate CRUD endpoint used by the frontend's own Activity/Task pages). Payload shape:

```json
{ "source": "DSA", "platform": "...", "title": "...", "problemTitle": "...", "difficulty": "...", "problemSlug": "...", "url": "...", "solvedAt": "..." }
```

`platform` must exactly match one of: `LeetCode, GFG, Codeforces, HackerRank, CodeChef, AtCoder, InterviewBit`.

**Dedup layers** — a solve can be silently dropped by any of these, useful to know when a test submission doesn't show up:
- Content-script cooldown: 15s per problem (`SEND_COOLDOWN_MS`)
- Background dedup cooldown: 30s (`ACTIVITY_COOLDOWN_MS`)
- Server-side: same user + platform + problem title on the same UTC calendar day → `409 Conflict`
- Failed sends retry with exponential backoff (`2000 * 2^attempt`, capped at 32s, max 5 retries)

### Per-platform detection signal

| Platform | Accept signal | Problem key format |
|---|---|---|
| LeetCode | "Accepted" + (testcases-passed text, runtime/memory stats, "Beats" stat, or result area) | slug from `/problems/{slug}` |
| GFG | "problem solved successfully", or "correct answer"/"accepted" + time/testcases/result signal | slug from `/problems/{slug}` |
| Codeforces | "Accepted" + fresh submission or verdict/result signal | `Codeforces:{contestId}-{problemId}` (hyphen). Difficulty is the raw rating number, not a bucketed label |
| HackerRank | "Accepted"/"Congratulations"/"100%"/"Score: X/X" + fresh submission or "test cases passed" signal | slug from `/challenges/{slug}` |
| CodeChef | "Accepted"/"Correct Answer" + fresh submission or verdict signal | code from `/problems/{code}` or `/submit/{code}`, uppercased |
| AtCoder | "AC"/"Accepted" + fresh submission or status/result signal | `AtCoder:{contestId}:{taskId}`. No difficulty extracted |
| InterviewBit | "Accepted"/"Correct"/"Correct Answer"/"Congratulations" + fresh submission or "test cases passed" signal | slug from `/problems/{slug}` |

### Debugging in the browser console

```js
Object.keys(self.__MomentumPlatforms)   // list registered adapters
self.__MomentumPlatforms.hackerrank     // inspect one adapter
```
Extension logs are prefixed `[Momentum]` — check the background service worker console and the content script console (on the platform's tab) separately.

### HackerRank test problems

Good low-friction problems for a quick manual pass: Solve Me First, Simple Array Sum, A Very Big Sum, Diagonal Difference, Plus Minus.

## Smoke-test checklist

```
[ ] Extension loads without errors (chrome://extensions)
[ ] Popup opens, shows login state correctly
[ ] Web login auto-syncs to the extension (One-Login)
[ ] Extension's own GitHub OAuth login works (requires EXTENSION_ID configured)
[ ] Logout clears auth state in both frontend and extension
[ ] Submitting a problem on each of the 7 platforms fires a POST /api/dsa/activity
[ ] Duplicate submission within cooldown window is correctly suppressed
[ ] No console errors in background, popup, or content script consoles
```
