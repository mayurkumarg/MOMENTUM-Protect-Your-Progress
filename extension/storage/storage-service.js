/**
 * Momentum Extension — Centralized Storage Service
 * Wraps all chrome.storage.local operations into a single reusable API.
 * No other module should access chrome.storage.local directly.
 * Exposed on self.__MomentumStorage for use across all extension contexts.
 *
 * Requires: config/constants.js (self.__MomentumConfig)
 */
(function () {
  const KEYS = self.__MomentumConfig.STORAGE_KEYS;

  self.__MomentumStorage = {
    // ── Auth-related ──────────────────────────────────────────────────

    getAuthData() {
      return new Promise((resolve) => {
        chrome.storage.local.get(
          [KEYS.TOKEN, KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN, KEYS.USER],
          (result) => {
            resolve({
              token: result[KEYS.TOKEN] || null,
              accessToken: result[KEYS.ACCESS_TOKEN] || null,
              refreshToken: result[KEYS.REFRESH_TOKEN] || null,
              user: result[KEYS.USER] || null,
            });
          }
        );
      });
    },

    getToken() {
      return new Promise((resolve) => {
        chrome.storage.local.get([KEYS.TOKEN, KEYS.ACCESS_TOKEN], (result) => {
          resolve(result[KEYS.TOKEN] || result[KEYS.ACCESS_TOKEN] || null);
        });
      });
    },

    getTokens() {
      return new Promise((resolve) => {
        chrome.storage.local.get([KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN], (result) => {
          resolve({
            accessToken: result[KEYS.ACCESS_TOKEN] || null,
            refreshToken: result[KEYS.REFRESH_TOKEN] || null,
          });
        });
      });
    },

    getUser() {
      return new Promise((resolve) => {
        chrome.storage.local.get([KEYS.USER], (result) => {
          resolve(result[KEYS.USER] || null);
        });
      });
    },

    setAuthData(data) {
      return new Promise((resolve) => {
        const payload = {};
        if (data.token !== undefined) payload[KEYS.TOKEN] = data.token;
        if (data.accessToken !== undefined) payload[KEYS.ACCESS_TOKEN] = data.accessToken;
        if (data.refreshToken !== undefined) payload[KEYS.REFRESH_TOKEN] = data.refreshToken;
        if (data.user !== undefined) payload[KEYS.USER] = data.user;
        chrome.storage.local.set(payload, resolve);
      });
    },

    setAccessToken(accessToken) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [KEYS.ACCESS_TOKEN]: accessToken }, resolve);
      });
    },

    async clearAuth() {
      await chrome.storage.local.remove([KEYS.TOKEN, KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN, KEYS.USER]);
    },
    async clearAuthData() {
      return this.clearAuth();
    },

    // ── Generic key access ────────────────────────────────────────────

    get(key) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key] !== undefined ? result[key] : null);
        });
      });
    },

    set(key, value) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
      });
    },

    remove(key) {
      return new Promise((resolve) => {
        chrome.storage.local.remove(key, resolve);
      });
    },
  };
})();
