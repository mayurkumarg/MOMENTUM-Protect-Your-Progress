/**
 * Momentum Extension — Content Script (localhost auth interceptor & sync)
 * Intercepts fetch/XHR requests to backend/frontend and adds auth headers.
 * Facilitates One-Login synchronization between website and extension.
 *
 * Requires: config/constants.js (self.__MomentumConfig)
 */

const __momentumConfig = self.__MomentumConfig;
const __momentumStorageKeys = __momentumConfig.STORAGE_KEYS;
const ACTIONS = __momentumConfig.MESSAGE_ACTIONS;

// Reloading/updating the extension orphans content scripts already injected
// into open tabs: this code keeps running but its chrome.* APIs are torn down
// and throw on touch. Nothing here can recover (only a page reload re-injects
// a live script), so every chrome.* entry point below degrades to a no-op
// instead of throwing — this script wraps the site's own fetch/XHR, and must
// never break the page it's a guest on.
function isExtensionAlive() {
  try {
    return Boolean(chrome?.runtime?.id);
  } catch {
    return false;
  }
}

// Utility to get token from extension storage
function getTokenFromStorage() {
  if (!isExtensionAlive()) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(
        [__momentumStorageKeys.TOKEN, __momentumStorageKeys.ACCESS_TOKEN],
        (result) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(
            result[__momentumStorageKeys.TOKEN] ||
            result[__momentumStorageKeys.ACCESS_TOKEN] ||
            null
          );
        }
      );
    } catch {
      // An unusable token store must not fail the request being wrapped —
      // it just means no Authorization header gets added.
      resolve(null);
    }
  });
}

// Intercept fetch requests to add auth header
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  let url = args[0];
  let options = args[1] || {};

  if (url instanceof Request) {
    url = url.url;
  }

  // Add auth header for API calls to backend/frontend
  if (__momentumConfig.isBackendOrFrontendUrl(url)) {
    const token = await getTokenFromStorage();
    if (token) {
      options.headers = options.headers || {};
      options.headers.Authorization = `Bearer ${token}`;
    }
  }

  return originalFetch.apply(this, args);
};

// Intercept XMLHttpRequest to add auth header
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url, ...args) {
  this._url = url;
  this._method = method;
  return originalOpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = async function (...args) {
  if (__momentumConfig.isBackendOrFrontendUrl(this._url)) {
    const token = await getTokenFromStorage();
    if (token) {
      this.setRequestHeader('Authorization', `Bearer ${token}`);
    }
  }

  return originalSend.apply(this, args);
};

// ═══════════════════════════════════════════════════════════════════════
// ONE-LOGIN INTEGRATION
// ═══════════════════════════════════════════════════════════════════════

function syncAuthWithExtension(token, refreshToken) {
  // sendMessage throws synchronously on an orphaned context, so .catch() alone
  // (which only handles the returned promise) would let a TypeError escape.
  if (!isExtensionAlive()) return;

  try {
    chrome.runtime.sendMessage({
      action: ACTIONS.SYNC_AUTH,
      token,
      refreshToken
    }).catch((err) => console.warn('[Momentum] Failed to sync auth:', err));
  } catch (err) {
    console.warn('[Momentum] Failed to sync auth:', err);
  }
}

// 1. Check local storage on load (handles refresh and installation while logged in)
const existingToken = localStorage.getItem('momentum-token');
const existingRefreshToken = localStorage.getItem('momentum-refresh-token');
if (existingToken) {
  syncAuthWithExtension(existingToken, existingRefreshToken);
}

// 2. Listen for auth changes emitted by the website's API client
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;

  if (event.data.type === 'MOMENTUM_AUTH_SYNC') {
    console.log('[Momentum] Received auth sync from website');
    syncAuthWithExtension(event.data.token, event.data.refreshToken);
  }
});

// 3. Expose extension status to the website.
//
// Detection must be race-proof: the website's React app and this content
// script can mount in either order. So we (a) set the status attribute
// SYNCHRONOUSLY and unconditionally the instant this script runs — never
// gated behind an async storage round-trip — and (b) answer a MOMENTUM_PING
// from the page, so if the page mounts after our one-shot announce it can
// still ask and get a fresh answer. The attribute name here is exactly the
// one the useExtension hook reads.
const STATUS_ATTR = 'data-momentum-extension-status';

function announceStatus(status) {
  document.documentElement.setAttribute(STATUS_ATTR, status);
  // Legacy alias kept for any older website build that looked for it.
  document.documentElement.setAttribute('data-momentum-extension-installed', 'true');
  window.postMessage({ type: 'MOMENTUM_EXTENSION_STATUS', status }, '*');
}

// Baseline: present but not necessarily logged in. Set immediately so the site
// detects the extension even if storage is slow or unavailable.
announceStatus('installed');

function publishStatusAndHealth() {
  // Orphaned: the baseline 'installed' announce above still stands (the
  // extension really is installed), we just can't read auth/sync state to
  // upgrade it to 'connected'. Bail rather than throw at the website.
  if (!isExtensionAlive()) return;

  try {
    chrome.storage.local.get([__momentumStorageKeys.USER, __momentumStorageKeys.SYNC_STATUS], (result) => {
      if (chrome.runtime.lastError) return;
      const isAuthenticated = !!result[__momentumStorageKeys.USER];
      announceStatus(isAuthenticated ? 'connected' : 'installed');

      const syncStatus = result[__momentumStorageKeys.SYNC_STATUS] || { state: 'Idle', pendingCount: 0 };
      window.postMessage({
        type: 'MOMENTUM_EXTENSION_HEALTH',
        health: {
          version: __momentumConfig.VERSION,
          authStatus: isAuthenticated ? 'connected' : 'disconnected',
          syncState: syncStatus.state,
          queueSize: syncStatus.pendingCount,
          lastSuccess: syncStatus.lastSuccess,
          lastError: syncStatus.lastError
        }
      }, '*');
    });
  } catch {
    // Context died between the check above and the call — nothing to publish.
  }
}

publishStatusAndHealth();

// Answer late pings from the website (covers the case where the page mounts
// after our initial announce already fired).
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) return;
  if (event.data.type === 'MOMENTUM_PING') {
    publishStatusAndHealth();
  }
});

// Re-publish whenever the stored auth/sync state changes (login, logout, sync).
// Registering is itself a chrome.* touch, so it has to tolerate a dead context
// the same way everything else here does.
if (isExtensionAlive()) {
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes[__momentumStorageKeys.USER] || changes[__momentumStorageKeys.SYNC_STATUS]) {
        publishStatusAndHealth();
      }
    });
  } catch {
    // No live storage to subscribe to — the baseline announce still stands.
  }
}
