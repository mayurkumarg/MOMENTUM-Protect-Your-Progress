# Momentum Sync Chrome Extension

Momentum Sync is a companion Chrome Extension for the Momentum platform. It seamlessly syncs Data Structures and Algorithms (DSA) problem-solving activities from popular coding platforms to the Momentum backend in real-time.

## Features
- **Zero-Friction Tracking:** Automatically detects when you solve problems on supported platforms.
- **One-Login Experience:** Authenticate once on the Momentum dashboard; the extension automatically synchronizes tokens and connects to your account.
- **Offline Reliability:** Built-in background synchronization engine with an offline queue. If you solve problems while offline or while the Momentum backend is unreachable, the extension securely caches them and retries with exponential backoff until successful delivery is confirmed.
- **Cross-Platform Support:** Works with LeetCode, GeeksforGeeks, Codeforces, HackerRank, CodeChef, AtCoder, and InterviewBit.

## Architecture Overview

The extension utilizes a highly reliable MV3 (Manifest V3) Service Worker architecture.

- **`background/`**: The core daemon. Houses `activityManager.js` (orchestrates deduping, retries, API communication) and `activityQueue.js` (durable offline storage).
- **`content/`**: Contains the content scripts injected into matching tabs. `content.js` intercepts network requests to attach authentication tokens and facilitates the One-Login flow via `window.postMessage`. `content-script.js` coordinates the parsing engines.
- **`providers/`**: The individual parsing engines tailored to each supported platform.
- **`config/`**: Centralized configuration and environment (`env.js`) injection logic.

### One-Login Authentication Flow

1. The user logs into the **Momentum Dashboard** (React frontend).
2. The dashboard emits a `MOMENTUM_AUTH_SYNC` message using `window.postMessage()`.
3. The `content.js` script intercepts the message and passes the payload (Access Token, Refresh Token) to the `background.js` Service Worker.
4. The background worker securely stores the credentials in `chrome.storage.local`.
5. The extension emits real-time `MOMENTUM_EXTENSION_HEALTH` events back to the dashboard, allowing the UI to reflect connection status, queue size, and sync states.

## Developer Setup

1. Clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `extension` directory.

### Environment Management
By default, the unpacked extension uses **Development** endpoints (`http://localhost:5000` and `http://localhost:3000`).

## Build Process (Production Release)

To create a production-ready `.zip` archive for the Chrome Web Store, we use a custom Node.js build pipeline that automatically scrubs development values and injects production environment URLs.

From the repository root (`MAIN/`), run:

```bash
npm run build:ext:prod
```

This script will:
1. Copy all necessary extension files to a new `dist-extension/` directory.
2. Strip out testing guides and redundant files.
3. Overwrite `config/env.js` with the `production` API and Dashboard URLs.
4. Generate a `momentum-sync-v1.0.0.zip` file ready for upload.

To build a zip for the staging/development environment, run:

```bash
npm run build:ext
```
