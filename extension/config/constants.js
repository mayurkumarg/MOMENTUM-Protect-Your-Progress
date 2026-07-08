/**
 * Momentum Extension — Centralized Configuration
 * Single source of truth for all constants, URLs, keys, and timing values.
 * Exposed on self.__MomentumConfig for use across all extension contexts.
 */
(function () {
  const env = self.__MomentumEnv || {};
  const BACKEND_URL = env.BACKEND_URL || 'http://localhost:5000';
  const FRONTEND_URL = env.FRONTEND_URL || 'http://localhost:5173';

  self.__MomentumConfig = {
    VERSION: '1.0.0',
    LOG_LEVEL: 3, // 1: ERROR, 2: WARN, 3: INFO, 4: DEBUG

    BACKEND_URL,
    FRONTEND_URL,

    API_ENDPOINTS: {
      AUTH_GITHUB: `${BACKEND_URL}/api/auth/github`,
      AUTH_REFRESH: `${BACKEND_URL}/api/auth/refresh`,
      DSA_ACTIVITY: `${BACKEND_URL}/api/dsa/activity`,
    },

    STORAGE_KEYS: {
      TOKEN: 'token',
      ACCESS_TOKEN: 'accessToken',
      REFRESH_TOKEN: 'refreshToken',
      USER: 'user',
      PENDING_ACTIVITIES: 'pendingActivities',
      RECENTLY_SENT: 'recentlySent',
      SYNC_STATUS: 'syncStatus',
    },

    MESSAGE_ACTIONS: {
      PERFORM_OAUTH: 'PERFORM_OAUTH',
      GET_TOKEN: 'GET_TOKEN',
      LOGOUT: 'LOGOUT',
      LOGIN_SUCCESS: 'LOGIN_SUCCESS',
      LOGIN_ERROR: 'LOGIN_ERROR',
      PROBLEM_SOLVED: 'PROBLEM_SOLVED',
      GET_STATUS: 'GET_STATUS',
      SYNC_AUTH: 'SYNC_AUTH',
      FLUSH_QUEUE: 'FLUSH_QUEUE',
    },

    ALARM_NAMES: {
      FLUSH_QUEUE: 'momentumFlushQueue',
    },

    TIMING: {
      FLUSH_INTERVAL_MINUTES: 5,
      ACTIVITY_COOLDOWN_MS: 30 * 1000,
      MAX_RETRIES: 5,
      MAX_QUEUE_SIZE: 50,
      MAX_RECENT_SENT: 100,
      RECENT_SENT_TTL_MS: 24 * 60 * 60 * 1000,
      OAUTH_TIMEOUT_MS: 5 * 60 * 1000,
      LOGIN_STATUS_HIDE_DELAY_MS: 1500,
    },

    CONTENT_SCRIPT_TIMING: {
      SUBMISSION_TIMEOUT_MS: 120 * 1000,
      DETECTION_RECHECK_MS: 900,
      STARTUP_QUIET_MS: 2500,
      SEND_COOLDOWN_MS: 15 * 1000,
      URL_POLL_MS: 1000,
      RETRY_DELAY_MS: 3000,
    },

    OBSERVER_OPTIONS: {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'data-e2e-locator', 'aria-label', 'role'],
    },

    /** Used by content.js to match backend/frontend fetch requests */
    isBackendOrFrontendUrl(url) {
      if (typeof url !== 'string') return false;
      const originB = new URL(BACKEND_URL).origin;
      const originF = new URL(FRONTEND_URL).origin;
      return url.startsWith(originB) || url.startsWith(originF);
    },
  };
})();
