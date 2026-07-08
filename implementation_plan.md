# Phase 1 — Extension Architecture Refactor

Refactor the Momentum Sync Chrome Extension into a clean, modular architecture while preserving all existing behavior exactly.

## Current State Analysis

The extension currently has a flat structure with significant code duplication:

| Issue | Details |
|---|---|
| **Duplicated utilities** | `normalize()`, `isVisible()`, `collectVisibleResultText()` are copy-pasted across all 7 platform files and `content-script.js` |
| **Duplicated JWT decode** | `decodeBase64Url()` and `decodeJWT()` exist in both `background.js` and `oauth-handler.html` |
| **Hardcoded URLs** | `localhost:5000` appears in `background.js`, `activityManager.js`, `content.js` (3 places) |
| **Hardcoded storage keys** | `'token'`, `'accessToken'`, `'refreshToken'`, `'user'`, `'pendingActivities'`, `'recentlySent'` scattered across 5 files |
| **Direct storage access** | `chrome.storage.local.get/set` called directly in `popup.js`, `content.js`, `background.js`, `activityManager.js`, `activityQueue.js`, `oauth-handler.html` |
| **Direct messaging** | `chrome.runtime.sendMessage()` called directly in `popup.js`, `content-script.js`, `background.js`, `oauth-handler.html` |
| **Flat file structure** | All files in root, no logical module separation |

---

## Proposed New Folder Structure

```
extension/
├── manifest.json                  (updated paths only)
├── popup.html                     (updated script src only)
├── oauth-handler.html             (updated to use shared modules)
│
├── config/
│   └── constants.js               [NEW] — Single source of truth for all config
│
├── shared/
│   └── dom-utils.js               [NEW] — normalize(), isVisible(), collectVisibleResultText()
│
├── utils/
│   └── jwt.js                     [NEW] — decodeBase64Url(), decodeJWT()
│
├── storage/
│   └── storage-service.js         [NEW] — Centralized chrome.storage wrapper
│
├── messaging/
│   └── messaging-service.js       [NEW] — Centralized chrome.runtime messaging
│
├── auth/
│   └── oauth.js                   [NEW] — OAuth flow logic (extracted from background.js)
│
├── background/
│   ├── background.js              [MODIFY] — Slim service worker (imports + wiring only)
│   ├── activityManager.js         [MODIFY] — Uses config/constants, storage-service
│   ├── activityQueue.js           [MODIFY] — Uses config/constants, storage-service
│   └── logger.js                  (unchanged)
│
├── popup/
│   └── popup.js                   [MODIFY] — Uses messaging-service, storage-service
│
├── content/
│   ├── content.js                 [MODIFY] — Uses config/constants
│   └── content-script.js          [MODIFY] — Uses shared/dom-utils
│
├── providers/
│   ├── leetcode.js                [MODIFY] — Uses shared/dom-utils
│   ├── gfg.js                     [MODIFY] — Uses shared/dom-utils
│   ├── codeforces.js              [MODIFY] — Uses shared/dom-utils
│   ├── hackerrank.js              [MODIFY] — Uses shared/dom-utils
│   ├── codechef.js                [MODIFY] — Uses shared/dom-utils
│   ├── atcoder.js                 [MODIFY] — Uses shared/dom-utils
│   └── interviewbit.js            [MODIFY] — Uses shared/dom-utils
```

---

## Proposed Changes

### Configuration Module

#### [NEW] [constants.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/config/constants.js)

Single source of truth for all hardcoded values:
- `BACKEND_URL` = `http://localhost:5000`
- `API_ENDPOINTS` — auth, activity, refresh URLs
- `FRONTEND_URL` = `http://localhost:3000`
- `STORAGE_KEYS` — token, accessToken, refreshToken, user, pendingActivities, recentlySent
- `EXTENSION_VERSION` = `1.0.0`
- `TIMING` — cooldown values, retry limits, TTLs, etc.
- `ALARM_NAMES` — momentumFlushQueue
- `SUPPORTED_PLATFORMS` list

---

### Shared DOM Utilities

#### [NEW] [dom-utils.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/shared/dom-utils.js)

Extract duplicated functions used by all platform providers and content-script:
- `normalizeText(text)` — whitespace normalization
- `isElementVisible(el)` — visibility check via computed style + bounding rect
- `collectVisibleText(selectors)` — gather visible text from selectors
- `getVisibleTextFromSelectors(selectors)` — (used by content-script for LeetCode strong signal)
- `findVisibleElementByText(pattern, selectors)` — (used by content-script)

> [!IMPORTANT]
> These are currently duplicated 8 times across platform files and content-script.js. The extracted versions will use the exact same logic — only the location changes.

---

### JWT Utility

#### [NEW] [jwt.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/utils/jwt.js)

Extract `decodeBase64Url()` and `decodeJWT()` which are currently duplicated in `background.js` and `oauth-handler.html`.

---

### Storage Service

#### [NEW] [storage-service.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/storage/storage-service.js)

Centralized storage wrapper using `STORAGE_KEYS` from config:
- `getToken()` — returns `{ token, accessToken, refreshToken }`
- `setToken(token)` / `setAccessToken(accessToken)`
- `getUser()` / `setUser(user)`
- `setAuthData({ token, accessToken, user })` — atomic multi-key set
- `clearAuth()` — removes all auth keys
- `get(key)` / `set(key, value)` — generic getter/setter for other keys

All current direct `chrome.storage.local.get/set` calls will be routed through this.

---

### Messaging Service

#### [NEW] [messaging-service.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/messaging/messaging-service.js)

- `sendToBackground(message)` — wraps `chrome.runtime.sendMessage()` with error handling
- `notifyPopup(message)` — wraps `chrome.runtime.sendMessage()` with catch for closed popup
- `MESSAGE_ACTIONS` — constants for `PERFORM_OAUTH`, `GET_TOKEN`, `LOGOUT`, `LOGIN_SUCCESS`, `LOGIN_ERROR`, `PROBLEM_SOLVED`

---

### Auth Module

#### [NEW] [oauth.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/auth/oauth.js)

Extract `performOAuth()` from `background.js`. It will import:
- `config/constants.js` for URLs
- `utils/jwt.js` for decoding
- `storage/storage-service.js` for token storage
- `messaging/messaging-service.js` for popup notification

---

### Background Service Worker

#### [MODIFY] [background.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/background/background.js)

Current `extension/background.js` moves into `extension/background/background.js`. It becomes a slim orchestrator that:
1. Imports all modules via `importScripts()`
2. Sets up the `onMessage` listener (delegating to handlers)
3. Sets up the `onChanged` listener
4. Sets up the alarm for queue flushing
5. Calls `ActivityManager.flushQueue()` on startup

All OAuth logic moves to `auth/oauth.js`. All hardcoded URLs move to `config/constants.js`.

#### [MODIFY] [activityManager.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/background/activityManager.js)

Replace hardcoded `API_URL`, `REFRESH_URL`, `COOLDOWN_MS`, `MAX_RETRIES`, etc. with imports from `config/constants.js`. Replace direct `chrome.storage.local.get` with `StorageService`.

#### [MODIFY] [activityQueue.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/background/activityQueue.js)

Replace hardcoded `STORAGE_KEY` and `MAX_QUEUE_SIZE` with values from `config/constants.js`.

---

### Popup

#### [MODIFY] [popup.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/popup/popup.js)

- Replace direct `chrome.runtime.sendMessage` with `MessagingService.sendToBackground()`
- Replace direct `chrome.storage.local.get` with `StorageService.getUser()` / `StorageService.getToken()`
- Use `MESSAGE_ACTIONS` constants instead of hardcoded strings

#### [MODIFY] [popup.html](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/popup.html)

Update `<script src>` to point to `popup/popup.js`.

---

### Content Scripts

#### [MODIFY] [content.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/content/content.js)

Replace hardcoded `localhost:5000` and `localhost:3000` with values from `config/constants.js`.

#### [MODIFY] [content-script.js](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/content/content-script.js)

- Use `shared/dom-utils.js` for `normalizeText`, `isElementVisible`, `getVisibleTextFromSelectors`, `findVisibleElementByText`
- Remove inline duplicates of these utility functions

---

### Platform Providers

#### [MODIFY] All 7 provider files → moved to `providers/` folder

Each provider will:
- Remove its own copy of `normalize()`, `isVisible()`, `collectVisibleResultText()`
- Use the shared versions from `shared/dom-utils.js` via `self.__MomentumDOMUtils`
- Keep all detection/extraction logic **exactly as-is**

---

### Manifest

#### [MODIFY] [manifest.json](file:///d:/WebDev/PROJECTS/MOMENTUM%20-%20-%20Protect%20Your%20Progress/MAIN/extension/manifest.json)

Update paths:
- `service_worker` → `background/background.js`
- `content_scripts[0].js` → `content/content.js`
- `content_scripts[1].js` → updated provider paths + shared utility loading order
- `default_popup` → `popup.html` (unchanged, stays at root)

> [!IMPORTANT]
> Content scripts cannot use ES modules. All shared code must be loaded via `importScripts()` (background) or additional `content_scripts.js` entries (content scripts). The shared utilities will be exposed on `self.__MomentumDOMUtils` and `self.__MomentumConfig` globals, consistent with the existing `self.__MomentumPlatforms` pattern.

---

## Open Questions

> [!IMPORTANT]
> **Popup script loading**: `popup.html` can load multiple `<script>` tags. Should the popup load shared modules (config, storage, messaging) as separate `<script>` tags, or should we inline the minimal subset it needs? I'm leaning towards separate `<script>` tags for consistency — this keeps the popup lightweight while still using the shared modules.

> [!NOTE]
> **oauth-handler.html**: This page duplicates `decodeBase64Url` and `decodeJWT`. After refactoring, it will load `utils/jwt.js` and `config/constants.js` as `<script>` tags. The inline script block will shrink significantly.

---

## Verification Plan

### Automated Tests
- No automated test framework exists, so verification is manual.

### Manual Verification
1. **Extension loads** — `chrome://extensions` shows no errors
2. **Popup opens** — Click extension icon, popup renders correctly
3. **Login flow** — GitHub OAuth completes, user info displays in popup
4. **LeetCode detection** — Submit a LeetCode problem, verify PROBLEM_SOLVED fires
5. **GFG detection** — Submit a GFG problem, verify PROBLEM_SOLVED fires
6. **Console check** — No errors in background console, popup console, or content script console
7. **Manifest check** — No manifest warnings in `chrome://extensions`
8. **Storage check** — `chrome.storage.local.get(null)` returns expected keys after login

### Smoke Test Checklist
```
[ ] Extension loads without errors
[ ] Popup opens and shows login button
[ ] GitHub OAuth flow completes
[ ] User info displays after login
[ ] Logout clears auth state
[ ] Content script injects on LeetCode problem pages
[ ] Content script injects on GFG problem pages
[ ] Platform adapters register on self.__MomentumPlatforms
[ ] No console errors anywhere
```
