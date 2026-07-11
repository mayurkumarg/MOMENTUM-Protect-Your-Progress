<div align="center">

# Momentum

**Protect your progress.**

A developer productivity platform that automatically tracks your DSA (Data Structures & Algorithms) practice, gives you a real analytics picture of your effort, mirrors your solves into your own GitHub repo, and includes an AI coach that already knows your data — with task planning, a placement tracker, and a calendar layered on top.

[Features](#features) · [Tech Stack](#tech-stack) · [Installation](#installation) · [Project Structure](#project-structure) · [License](#license)

</div>

---

## Why Momentum

Most DSA trackers require you to manually log every problem you solve. Momentum doesn't. A companion Chrome extension watches supported coding platforms in the background and detects when you solve a problem — no copy-pasting, no manual entry, no broken streaks because you forgot to log something. That real, verified activity data is what powers everything else in the app: analytics that mean something, an AI assistant that answers from your actual workspace instead of guessing, and a GitHub journal that gives you a portable, self-owned record of your work outside the app.

## Features

### Core loop — automatic activity capture

- **Zero-effort DSA tracking** — the browser extension detects solved problems on **LeetCode, GeeksforGeeks, Codeforces, HackerRank, CodeChef, AtCoder, and InterviewBit**, with an offline queue and retry-with-backoff so nothing is lost if you're offline or the backend is briefly unreachable.
- **Analytics** — a 14-week activity heatmap, weekly productivity trend, platform/difficulty breakdowns, task-completion tracking, and streak tracking, all computed from real logged activity.
- **Coding Journal (GitHub sync)** — connect a GitHub repository and Momentum mirrors your solved problems into it as a running journal, using the Git Data API with a per-user write queue and optimistic-concurrency retry for correctness under concurrent writes. You get a portable, self-owned proof-of-work artifact that isn't locked into the app.
- **AI Assistant** — a coach grounded in your real Momentum data (tasks, DSA activity, GitHub sync status, placement pipeline, analytics), not a generic chatbot. Every context section fails soft, so a missing data source never breaks the conversation.

### Planning

- **Tasks** — list and Kanban board views, priorities, subtasks, tags, custom grouping/sorting, bulk actions, and browser-based reminders.
- **Calendar** — day/week/month views that recombine your existing tasks and activity into one timeline, with zero additional data entry.
- **Placement Tracker** — track companies through a 9-stage pipeline (wishlist → applied → interviewing → offer), with prep tasks and notes linked per company.
- **Workspace / Notes** — lightweight Markdown notes with checklists, links, and file attachments, attachable to a task or a company.

### Account & platform

- Email/password auth and GitHub OAuth, with short-lived access tokens and **rotating, hashed refresh tokens** stored in their own collection with a per-token TTL.
- Rate limiting on login, registration, token refresh, GitHub OAuth, and the AI assistant endpoint.
- A production security baseline: Helmet security headers, environment validation that refuses to boot with weak secrets in production, centralized error handling that never leaks internals, and graceful shutdown.

## Tech stack

| Layer | Stack |
|---|---|
| **Backend** | Node.js, Express 5, MongoDB + Mongoose, JWT (access + rotating refresh tokens), bcrypt, Helmet, express-rate-limit |
| **Frontend** | React 18, Vite, React Router, Tailwind CSS, Lucide icons |
| **Extension** | Chrome Manifest V3 (service worker background script + per-platform content-script detectors) |
| **AI** | Groq (OpenAI-compatible chat completions API) |
| **GitHub integration** | GitHub REST + Git Data API, OAuth (authorization-code flow), AES-256-GCM token encryption at rest |

## Installation

### Prerequisites

- Node.js 18+
- A MongoDB instance (local or Atlas)
- A [GitHub OAuth App](https://github.com/settings/developers) (required — the backend won't boot without GitHub OAuth credentials, even if you don't plan to use GitHub sync)
- Optional: a free [Groq API key](https://console.groq.com/keys) to enable the AI Assistant

### 1. Clone and install

```bash
git clone https://github.com/mayurkumarg/MOMENTUM---Protect-Your-Progress.git
cd MOMENTUM---Protect-Your-Progress

# Backend (scripts live in the root package.json — there's no backend/package.json)
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env` — at minimum `MONGO_URI`, `JWT_SECRET` (32+ characters), and your GitHub OAuth app's `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI`. Full variable reference, generating a secret, and GitHub OAuth app setup: **[SETUP.md](SETUP.md)**.

### 3. Run it

```bash
# Terminal 1 — backend (http://localhost:5000)
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd frontend
npm run dev
```

### 4. Load the browser extension (optional, for automatic tracking)

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. Log in on the web app — the extension picks up your session automatically (no separate login needed).

To package a distributable build: `npm run build:ext` (dev URLs) or `npm run build:ext:prod` (production URLs) from the repo root — outputs to `dist-extension/` and a versioned zip.

## Project structure

```
backend/            Express 5 + Mongoose API
  modules/           One folder per domain (auth, task, activity, analytics,
                      assistant, github, companies, notes, workload, user) —
                      each following model → service → controller → routes
  middlewares/        Auth guard, rate limiters, centralized error handler
  config/             Env validation, DB connection
  scripts/            Local dev utilities (e.g. demo data seeding)

frontend/            React 18 + Vite dashboard
  src/pages/           Route-level views (Overview, Tasks, Activity, Analytics,
                        Assistant, Calendar, Placements, Settings, ...)
  src/components/      Shared UI primitives + feature components
  src/hooks/           Data-fetching and derived-state hooks per domain
  src/api/             Thin fetch wrappers per backend module

extension/           Chrome MV3 extension
  background/          Service worker: activity queue, retry/backoff, auth refresh
  content/              Injected scripts: platform-solve detection, One-Login sync
  providers/            Per-platform DOM detectors (LeetCode, GFG, Codeforces, ...)
  popup/                Extension popup UI

scripts/             Extension build/packaging (npm run build:ext)
```

See [SETUP.md](SETUP.md) for full environment configuration and [TESTING.md](TESTING.md) for manual verification procedures (there is no automated test suite yet).

## Security

Momentum follows a real production security baseline: ownership-scoped queries on every read/write, mass-assignment protection via explicit field allowlists, hashed + rotating refresh tokens, rate limiting on sensitive endpoints, Helmet security headers, and startup environment validation that refuses to run with weak secrets in production. If you find a security issue, please open an issue rather than a public PR with exploit details.

## License

MIT © [Mayur Kumar G](https://github.com/mayurkumarg) — see [LICENSE](LICENSE).
