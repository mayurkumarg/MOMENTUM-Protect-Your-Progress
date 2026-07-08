# Momentum

Momentum tracks your DSA (data structures & algorithms) practice automatically. A Chrome extension detects when you solve a problem on LeetCode, GeeksforGeeks, Codeforces, HackerRank, CodeChef, AtCoder, or InterviewBit, and syncs it to your Momentum dashboard.

## Structure

```
backend/      Express 5 + Mongoose API (auth, activity tracking, tasks)
frontend/     React 18 + Vite dashboard
extension/    Chrome MV3 extension (problem-solve detection + sync)
scripts/      Extension build/packaging (npm run build:ext)
```

See [SETUP.md](SETUP.md) for environment setup and [TESTING.md](TESTING.md) for manual test procedures.

## Running locally

All three pieces run independently. Start whichever you're working on.

**Backend** (from repo root — there is no `backend/package.json`, scripts live in the root `package.json`):
```
npm install
npm run dev        # nodemon, http://localhost:5000
```

**Frontend**:
```
cd frontend
npm install
npm run dev         # Vite, http://localhost:5173, proxies /api to :5000
```

**Extension** (no build step needed for local dev):
1. `chrome://extensions` → enable Developer mode → **Load unpacked** → select the `extension/` folder.
2. To package a distributable build: `npm run build:ext` (development env) or `npm run build:ext:prod` from the repo root — outputs to `dist-extension/` and a versioned zip.

## Auth

Supports email/password (bcrypt) and GitHub OAuth, with short-lived JWT access tokens (15m) and longer-lived refresh tokens (30d). The extension can also pick up an existing web session automatically ("One-Login"): logging in on the frontend posts the tokens to the extension via `window.postMessage`, so you don't need to log in twice. See [SETUP.md](SETUP.md) for required env vars and GitHub OAuth app setup.

## Platforms

Each of the 7 supported platforms has a detector in `extension/providers/`. They watch the DOM for an accepted/solved signal, extract problem metadata, and post to the backend at `POST /api/dsa/activity`. See [TESTING.md](TESTING.md) for per-platform detection details and manual test steps.
