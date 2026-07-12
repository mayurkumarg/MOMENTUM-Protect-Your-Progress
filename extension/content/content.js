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

// Utility to get token from extension storage
function getTokenFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [__momentumStorageKeys.TOKEN, __momentumStorageKeys.ACCESS_TOKEN],
      (result) => {
        resolve(
          result[__momentumStorageKeys.TOKEN] ||
          result[__momentumStorageKeys.ACCESS_TOKEN] ||
          null
        );
      }
    );
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
  chrome.runtime.sendMessage({
    action: ACTIONS.SYNC_AUTH,
    token,
    refreshToken
  }).catch((err) => console.warn('[Momentum] Failed to sync auth:', err));
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
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes[__momentumStorageKeys.USER] || changes[__momentumStorageKeys.SYNC_STATUS]) {
    publishStatusAndHealth();
  }
});
