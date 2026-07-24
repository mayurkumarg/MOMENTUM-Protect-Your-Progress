# Momentum — Product Overview

**Phase 1 of the Momentum documentation series — the product, not the code.**

This document explains what Momentum is, why it exists, who it serves, and how every part of it fits together. It is written to be read before any architecture or implementation document. No prior knowledge of the codebase is assumed.

---

## 1. The One-Paragraph Pitch

**Momentum is a preparation operating system for students grinding toward placements.** It watches you solve problems on LeetCode, Codeforces, GeeksforGeeks and four other judges through a browser extension, records each solve automatically — with the real time you spent on it — and turns that stream of evidence into three things students otherwise never get: a permanent, self-updating GitHub portfolio of everything they have solved; an honest picture of whether their preparation is actually consistent; and a workload readout that says whether their coming week is under control or about to collapse. The tagline is *"Protect Your Progress"*, and it is meant literally — the work you already did should never be invisible, forgotten, or unprovable.

---

## 2. The Problem

Placement preparation is the highest-stakes period of an engineering student's degree, and it is almost entirely unmanaged. Four specific failures show up again and again.

### 2.1 Progress evaporates

A student solves 300 problems across eight months. At the end, they have almost nothing to show for it. The solves live inside LeetCode's own submission history — a walled garden that is not portable, not presentable to a recruiter, and not something they control. Ask them "what did you do in March?" and the honest answer is a shrug. The effort was real; the record of it is not.

### 2.2 Manual tracking always dies

The standard fix is a spreadsheet or a Notion board. It works for about eleven days. Logging is a second, unrewarded task performed at exactly the moment the student is most drained — right after finally cracking a hard problem. Any system that depends on the user's discipline to record their discipline is built on sand. **The tracking must be automatic or it will not survive contact with a real semester.**

### 2.3 Effort is confused with progress

"I've been studying a lot lately" is a feeling, not a fact. Without data, students cannot distinguish a genuinely strong week from a week that merely felt busy. They cannot see that they have not touched a problem in nine days, or that their streak quietly ended. Self-assessment during preparation is systematically unreliable, and the correction — real numbers — is exactly what is missing.

### 2.4 Everything is scattered

DSA practice is on LeetCode. Deadlines are in a phone reminder. Company applications are in a spreadsheet. Interview dates are in email. Notes are across three apps. There is no single surface that answers the only question that actually matters on a given morning: **"what should I do today, and am I on track?"**

---

## 3. The Core Insight

Most productivity tools ask the user to *describe* their work. Momentum **observes** it.

That inversion is the whole product. Because capture is passive, the dataset stays honest and complete — it does not decay when motivation dips, which is precisely when accurate data is most valuable. And because the data is trustworthy, everything downstream becomes trustworthy too: the analytics are real, the streaks are earned, the GitHub portfolio is genuine evidence rather than a curated highlight reel.

A second insight shapes the tone. Momentum deliberately refuses to nag. A brand-new user is shown *"Not Started"*, never *"Needs Attention"* — the system does not scold someone for having just arrived. The product's stance toward the user is that of a calm instrument panel, not a demanding coach.

---

## 4. Who It Is For

**Primary user — the placement-season engineering student.** Preparing for campus placements or SDE internships. Solving problems most days across two or three judges. Juggling coursework deadlines against practice. Tracking a shortlist of target companies with real interview dates. This user's defining constraint is that their preparation is long, unstructured, and entirely self-directed.

**Secondary users** who fit the same shape:
- **Self-taught developers** building a demonstrable track record without a degree to point at.
- **Interview candidates** running a focused multi-week grind before a hiring loop.
- **Consistency-driven learners** who respond to streaks and visible progress.

**Explicitly not built for:** teams, managers, or classrooms. Momentum is strictly single-player. There is no sharing, no leaderboard, no social layer, and no admin console. Every piece of data belongs to exactly one user, and that constraint is enforced at the database level on every query.

---

## 5. The User Journey

### Stage 1 — Arrival and account
The user registers with email and password, or with **Continue with GitHub** in one step. Registration signs them straight in — no confirmation wall, no second login. From the very first screen they land on a working dashboard rather than an empty setup checklist.

### Stage 2 — Installing the extension
The dashboard's first prompt is to install the browser extension, and a dedicated **Install** page walks through it: download, open the extensions page, enable developer mode, load the folder. Small deliberate touches remove the friction — Chrome blocks websites from linking directly to `chrome://extensions`, so the page offers the address as a one-click copy instead of a dead link.

Once installed, the extension announces itself to the website and the install prompt disappears everywhere at once. If the user is already signed in on the site, the extension picks up that session automatically — **there is no second login.** This "one-login" behaviour is a small thing that matters a lot: the moment a tool asks you to authenticate twice, it feels like two tools.

### Stage 3 — The invisible core loop
This is the stage where the product does its real work, and the user does nothing at all.

They open LeetCode and start a problem. The extension quietly notes when they first saw it. They think, write, submit, fail, resubmit. When a submission is finally **Accepted**, the extension detects it from the page itself, captures the problem title, platform, language, and difficulty, reads the judge's own timer for the true solve duration, and sends the record to the backend.

Then several things happen without a single click:

- the solve appears in **Activity**;
- the **Analytics** heatmap gains a square and the streak advances;
- the **Workload** readout recalculates;
- and — if GitHub is connected — a markdown file is committed to the user's own repository, filed under `Platform/Difficulty/problem-name.md`, with the journal index and README updated alongside it.

If the network is down, the solve is queued locally and retried later. If the same problem is solved twice, it is deduplicated. **The user's only job was to solve the problem.**

### Stage 4 — Daily orientation
Each morning the user opens **Overview**: today's tasks, current workload status, recent activity, what is coming next. It is designed to answer "what now?" in a few seconds, and it deliberately shows only what already exists in their records — it never invents motivational filler.

### Stage 5 — Planning and preparation
Across the week they work in the planning modules — adding tasks with deadlines and estimates, breaking large ones into subtasks in the Task Workspace, tracking target companies through their interview pipeline, and reviewing the calendar. Reminders arrive in-app and by email.

### Stage 6 — Reflection and proof
Periodically they open **Analytics** to see the last 98 days at a glance, ask the **Assistant** questions about their own record, or send a recruiter a link to a GitHub repository that has been quietly building itself the entire time.

---

## 6. The Modules

Momentum is organised into eleven backend domains surfaced through sixteen application screens. Each module has one job.

### Capture layer

**Browser Extension — automatic solve detection.**
Supports seven judges: **LeetCode, Codeforces, GeeksforGeeks, HackerRank, CodeChef, AtCoder, and InterviewBit.** Each has its own adapter, because every site announces success differently. The extension watches the page for an accepted verdict, captures the metadata, and reads the platform's own timer at submit time — giving a *real* solve duration rather than a guess. It holds an offline queue so nothing is lost when connectivity drops, deduplicates aggressively so nothing is double-counted, and refreshes its own auth token in the background so it keeps working for weeks without attention.

**Activity — the single source of truth.**
Every recorded unit of work, from any origin. Activities carry a source (`DSA` from the extension, `MANUAL`, or `GITHUB`) and a type (`CODING`, `STUDY`, `ASSIGNMENT`, `PROJECT`, `REVISION`, `OTHER`), so hand-logged study sessions live alongside auto-captured solves in one timeline. Every analytics number in the product traces back to this collection.

### Intelligence layer

**Analytics — the honest mirror.**
A 98-day contribution heatmap (fourteen full weeks, a deliberate bound rather than an unlimited scan), current and longest streaks, week-over-week comparison, and platform/difficulty breakdowns. Its purpose is to replace *"I think I've been consistent"* with a number.

**Workload — the early-warning system.**
The most opinionated module in the product. It reads open tasks, deadlines, estimated hours, and recent activity, then classifies the user's state across four independent dimensions:

| Dimension | Values | What it answers |
|---|---|---|
| **Workload Level** | Low · Moderate · High | How much is on my plate? |
| **Schedule Tightness** | Relaxed · Tight · Critical | How soon is it all due? |
| **Task Consistency** | Not Started · Needs Attention · Building · On Track | Am I actually showing up? |
| **Overall Status** | Light · Balanced · Stretched · Overloaded | The synthesis. |

Separating "a lot of work" from "work due imminently" is the design decision that makes this useful — twenty relaxed hours and four hours due tomorrow are completely different emergencies, and a single score would blur them. The rules are transparent and threshold-based by choice: a student should be able to understand *why* they were told they are overloaded.

**Assistant — a grounded answer engine.**
A conversational layer that is given the user's actual context — open tasks, today's activity, recent solves, workload state, analytics summary — before it answers. It is not a general chatbot bolted on; it is scoped to answer questions about *your* preparation using *your* data.

### Planning layer

**Tasks & Task Workspace.** Tasks carry deadlines, estimated hours, priority, status, subtasks, and tags. The Workspace expands a single task into a focused surface with its notes attached. Estimated hours are not decoration — they feed directly into the workload engine. A task can also be linked to a company in the Placement Tracker, so "revise system design" can belong to the Amazon interview rather than floating loose.

**Calendar.** Deadlines and placement events on one timeline, so a submission deadline and an interview are never discovered separately.

**Placements.** A pipeline for target companies, moving through **Wishlist → Preparing → Applied → Interviewing → Selected / Rejected / Withdrawn**, with important dates and per-event reminders. This is the module that turns Momentum from a practice tracker into a placement-season tool.

**Notes.** A deliberately generic notes system attached to tasks, projects, or companies through a polymorphic reference, with pinning and checklists — one implementation serving three surfaces rather than three separate note features.

### Output layer

**GitHub Journal — the portfolio that writes itself.**
The module that converts effort into evidence. The user connects GitHub and picks or creates a repository. From then on, every solve is committed automatically: a markdown file per problem organised by platform and difficulty, containing the attempt history and real solve time, plus a maintained index and README. Repeat solves append a new attempt rather than overwriting history.

The result is a public, timestamped, recruiter-readable record of months of work — created entirely as a by-product of solving problems. **The user never writes a commit message.**

**Notifications.** Reminders for task deadlines and placement events, delivered in-app and over email, with the channel under user control.

---

## 7. How the Parts Create Value Together

The modules are not a feature list; they form a loop where each stage feeds the next.

```
          ┌──────────────────────────────────────────────┐
          │                                              │
          ▼                                              │
    You solve a problem                                  │
          │                                              │
          ▼                                              │
    Extension detects it  ──── captures real solve time  │
          │                                              │
          ▼                                              │
    Activity record created  (single source of truth)    │
          │                                              │
          ├──────────────┬───────────────┬───────────────┤
          ▼              ▼               ▼               ▼
     Analytics      Workload        GitHub Journal   Assistant
     heatmap        recalculates    auto-commits     answers from
     & streaks      your week       your portfolio   real context
          │              │               │               │
          └──────────────┴───────┬───────┴───────────────┘
                                 ▼
                   You see where you actually stand
                                 │
                                 ▼
                      You plan the next move
                                 │
                                 └──────────► (loop closes)
```

The critical property is that **the loop is entered passively.** In a manual tracker the loop starts with "remember to log it," which is exactly where these systems fail. Here it starts with solving a problem — something the user was going to do anyway. Every downstream benefit is unlocked by work the user already wanted to do.

A second property: **one honest dataset powers four different lenses.** The analytics, the workload classification, the GitHub journal, and the assistant's answers are all views over the same Activity records. Nothing can drift out of sync with anything else, because there is only one truth.

---

## 8. What Makes Momentum Different

**Capture is passive, not manual.** This is the foundational difference. Comparable tools ask you to log; Momentum watches. Everything else follows from that.

**It covers seven judges, not one.** Most trackers are LeetCode-only. Serious preparation is not, and a tracker that sees a third of your work produces analytics that are worse than none.

**It measures real solve time.** Rather than assuming or estimating, the extension reads the judge's own timer at the moment of submission. "How long do mediums actually take me?" becomes an answerable question.

**The portfolio is a by-product.** Other tools show you a dashboard. Momentum also produces an artifact you own, in your own GitHub account, that outlives your use of the product. If Momentum disappeared tomorrow, the repository would remain — and that is a deliberate design stance, not an oversight.

**It separates workload from urgency.** Four dimensions instead of one score, because "a lot of work" and "work due tomorrow" demand different responses.

**It connects practice to placements.** DSA tracking and company pipelines in one product, because for the target user they are the same project.

**It refuses to nag.** Neutral states for new users, no manufactured urgency, no guilt mechanics. The product's job is to inform, not to pressure.

---

## 9. The Experience, In One Sentence Each

- **You never log anything.** Solving is the only action required.
- **You always know where you stand.** Four-dimensional workload, honest streaks, no ambiguity.
- **You accumulate proof automatically.** A GitHub portfolio grows in the background.
- **You sign in once.** The extension inherits your session from the website.
- **You lose nothing.** Offline queueing, deduplication, and retrying mean a solve survives bad networks and closed laptops.
- **You are treated as an adult.** No streak guilt, no dark patterns, no notifications you did not ask for.

---

## 10. Scope — What Momentum Deliberately Is Not

Stating the boundaries honestly is part of understanding the product.

- **Not a judge or an editor.** It never runs code or hosts problems. It observes work done on the real platforms.
- **Not a course or content library.** It brings no curriculum, no problem sets, no tutorials.
- **Not collaborative.** Single-user by design. No teams, sharing, or leaderboards.
- **Not a predictive model.** The workload engine is transparent and rule-based on purpose. It reports the state you are in; it does not forecast outcomes or claim to know your chances.
- **Not a mobile app.** Desktop web plus a Chromium browser extension, matching where the work actually happens.
- **Not fully hands-off for GitHub.** The user chooses the repository and authorises access; Momentum will not silently reach into an account.

---

## 11. Current Status

Momentum is **deployed and running in production**, not a prototype:

| Layer | Platform |
|---|---|
| Frontend | Vercel |
| Backend API | Render |
| Database | MongoDB Atlas |
| Extension | Distributed as a downloadable package from the app's own Install page |
| CI | GitHub Actions on every push and pull request |

The full journey described in this document — register, install, solve, auto-capture, auto-commit, analyse — works end to end against the live deployment today.

---

## 12. Where to Go Next

This document covered the product. The remaining phases cover how it is built:

- **Phase 2 — System Architecture:** the three-surface model (web app, API, extension) and how they communicate.
- **Phase 3 — Backend Deep Dive:** the eleven domain modules, the API surface, and the data model.
- **Phase 4 — Extension Engineering:** platform adapters, detection strategy, offline queue, and the Manifest V3 service worker.
- **Phase 5 — Feature-Level Implementation:** every major feature end to end, and how they interlock.
- **Phase 6 — Technical Implementation:** layer-by-layer engineering decisions, shared primitives, security, and technical debt.
- **Phase 7 — End-to-End System Flows:** complete request/data journeys across every layer.
- **Phase 8 — Engineering Decisions & Insights:** the reasoning, trade-offs, challenges, and lessons behind the build.

---

*Momentum — Protect Your Progress.*
