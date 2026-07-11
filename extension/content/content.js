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

// 3. Expose Extension Status to the website
document.documentElement.setAttribute('data-momentum-extension-installed', 'true');

// Initial status check to expose connection state
chrome.storage.local.get([__momentumStorageKeys.USER, __momentumStorageKeys.SYNC_STATUS], (result) => {
  if (chrome.runtime.lastError) return;
  const isAuthenticated = !!result[__momentumStorageKeys.USER];
  const status = isAuthenticated ? 'connected' : 'installed';
  document.documentElement.setAttribute('data-momentum-extension-status', status);
  window.postMessage({ type: 'MOMENTUM_EXTENSION_STATUS', status }, '*');
  
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

// Listen for status changes from background
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes[__momentumStorageKeys.USER]) {
      const isAuthenticated = !!changes[__momentumStorageKeys.USER].newValue;
      const status = isAuthenticated ? 'connected' : 'installed';
      document.documentElement.setAttribute('data-momentum-extension-status', status);
      window.postMessage({ type: 'MOMENTUM_EXTENSION_STATUS', status }, '*');
    }
    
    if (changes[__momentumStorageKeys.USER] || changes[__momentumStorageKeys.SYNC_STATUS]) {
      chrome.storage.local.get([__momentumStorageKeys.USER, __momentumStorageKeys.SYNC_STATUS], (result) => {
        const isAuthenticated = !!result[__momentumStorageKeys.USER];
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
  }
});
