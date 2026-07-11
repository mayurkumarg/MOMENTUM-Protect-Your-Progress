/**
 * Activity Manager — Core Orchestrator
 *
 * Responsibilities:
 * - Deduplication (session + storage + cooldown)
 * - Retry with exponential backoff (max 5 retries)
 * - Offline queue integration
 * - API communication
 * - Debug helpers
 *
 * Requires:
 *   config/constants.js           (self.__MomentumConfig)
 *   storage/storage-service.js    (self.__MomentumStorage)
 *   background/logger.js          (self.MomentumLogger)
 *   background/activityQueue.js   (self.ActivityQueue)
 */
(function () {
  const log = self.MomentumLogger;
  const queue = self.ActivityQueue;
  const config = self.__MomentumConfig;
  const storage = self.__MomentumStorage;

  const API_URL = config.API_ENDPOINTS.DSA_ACTIVITY;
  const REFRESH_URL = config.API_ENDPOINTS.AUTH_REFRESH;
  const COOLDOWN_MS = config.TIMING.ACTIVITY_COOLDOWN_MS;
  const MAX_RETRIES = config.TIMING.MAX_RETRIES;
  const RECENTLY_SENT_KEY = config.STORAGE_KEYS.RECENTLY_SENT;
  const STATUS_KEY = config.STORAGE_KEYS.SYNC_STATUS;
  const MAX_RECENT = config.TIMING.MAX_RECENT_SENT;
  const RECENT_TTL_MS = config.TIMING.RECENT_SENT_TTL_MS;

  // In-memory dedup for current service worker session
  const sessionKeys = new Set();
  let isRefreshing = false;
  let refreshPromise = null;

  // ── Sync Status ──────────────────────────────────────────────────────

  async function updateSyncStatus(updates) {
    const res = await storage.get(STATUS_KEY);
    const status = res || { state: 'Idle', lastSuccess: null, lastError: null, pendingCount: 0 };
    Object.assign(status, updates);
    await storage.set(STATUS_KEY, status);
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  function generateKey(data) {
    const date = new Date(data.solvedAt).toISOString().split('T')[0];
    return `${data.platform}-${data.problemTitle}-${date}`;
  }

  async function getRecentlySent() {
    const result = await storage.get(RECENTLY_SENT_KEY);
    return result || {};
  }

  async function markAsSent(key) {
    const recent = await getRecentlySent();
    recent[key] = Date.now();

    // Purge expired entries
    const now = Date.now();
    const cleaned = {};
    for (const [k, ts] of Object.entries(recent)) {
      if (now - ts < RECENT_TTL_MS) cleaned[k] = ts;
    }

    // Trim to max size (keep newest)
    const entries = Object.entries(cleaned).sort((a, b) => b[1] - a[1]);
    const trimmed = Object.fromEntries(entries.slice(0, MAX_RECENT));

    await storage.set(RECENTLY_SENT_KEY, trimmed);
    sessionKeys.add(key);
  }

  async function isDuplicate(data) {
    const key = generateKey(data);

    if (sessionKeys.has(key)) {
      log.warn('Duplicate prevented (session):', key);
      return true;
    }

    const recent = await getRecentlySent();
    if (recent[key] && Date.now() - recent[key] < COOLDOWN_MS) {
      log.warn('Duplicate prevented (cooldown):', key);
      return true;
    }

    return false;
  }

  async function refreshAccessToken() {
    // Prevent multiple simultaneous refresh calls
    if (isRefreshing) {
      return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = (async () => {
      try {
        const tokens = await storage.getTokens();
        if (!tokens.refreshToken) {
          throw new Error('NO_REFRESH_TOKEN');
        }

        const res = await fetch(REFRESH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        });

        if (!res.ok) {
          throw new Error('Token refresh failed');
        }

        const result = await res.json();
        // Backend returns { data: { token, refreshToken } }. Refresh tokens are
        // single-use (rotated) server-side, so the response also carries a NEW
        // refresh token — persist BOTH or the next refresh will fail with a
        // now-invalidated token.
        const newAccessToken = result.data && result.data.token;
        const newRefreshToken = result.data && result.data.refreshToken;
        if (!newAccessToken) {
          throw new Error('Token refresh response missing token');
        }

        await storage.setAuthData({
          accessToken: newAccessToken,
          ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
        });
        log.info('Access token refreshed successfully');

        return newAccessToken;
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  // ── API Communication ───────────────────────────────────────────────

  async function sendToAPI(data, shouldRetryRefresh = true) {
    if (self.__momentumForceOffline) {
      throw new Error('FORCE_OFFLINE');
    }

    const tokens = await storage.getTokens();
    if (!tokens.accessToken) throw new Error('NO_TOKEN');

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (res.status === 409) {
      log.info('Backend duplicate — already saved:', data.problemTitle);
      return result;
    }

    // Handle token expiration — try to refresh and retry
    if (res.status === 401 && shouldRetryRefresh) {
      log.warn('Access token expired, attempting refresh...');
      try {
        await refreshAccessToken();
        // Retry with refreshed token (but don't refresh again to prevent infinite loops)
        return await sendToAPI(data, false);
      } catch (err) {
        log.error('Token refresh failed:', err.message);
        throw new Error(`HTTP ${res.status}: Invalid or expired token`);
      }
    }

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${result.message || 'Unknown error'}`);
      err.status = res.status;
      throw err;
    }

    return result;
  }

  function backoffDelay(attempt) {
    return Math.min(2000 * Math.pow(2, attempt), 32000);
  }

  async function sendWithRetry(data) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await sendToAPI(data);
      } catch (err) {
        if (err.message === 'NO_TOKEN' || err.message === 'FORCE_OFFLINE') {
          throw err;
        }

        // Do not retry on permanent client errors
        if (err.status === 400 || err.status === 422 || err.status === 404 || err.status === 403) {
          log.error('Permanent client error, aborting retry:', err.message);
          throw err;
        }

        if (attempt < MAX_RETRIES) {
          const delay = backoffDelay(attempt);
          log.warn(`Retry attempt ${attempt + 1}/${MAX_RETRIES} in ${delay}ms:`, err.message);
          await new Promise((r) => setTimeout(r, delay));
        } else {
          log.error('Permanent failure after', MAX_RETRIES, 'retries:', data.problemTitle);
          throw err;
        }
      }
    }
  }

  // ── Public API ──────────────────────────────────────────────────────

  self.ActivityManager = {
    async handleActivity(data) {
      log.info('Activity detected:', data.platform, '-', data.problemTitle);

      if (await isDuplicate(data)) return { deduplicated: true };

      const key = generateKey(data);
      await updateSyncStatus({ state: 'Syncing' });

      try {
        const result = await sendWithRetry(data);
        await markAsSent(key);
        await updateSyncStatus({ state: 'Idle', lastSuccess: Date.now() });
        log.info('Activity synced:', data.problemTitle);
        return result;
      } catch (err) {
        if (err.message === 'NO_TOKEN') {
          log.error('No token — user not logged in');
          await updateSyncStatus({ state: 'Error', lastError: err.message });
          return;
        }
        
        // Permanent failures should not go to the queue
        if (err.status === 400 || err.status === 422 || err.status === 403) {
           log.error('Dropped invalid activity:', err.message);
           await updateSyncStatus({ state: 'Error', lastError: err.message });
           return;
        }

        await queue.enqueue(data);
        await markAsSent(key);
        await updateSyncStatus({ state: 'Offline', lastError: err.message });
      }
    },

    async flushQueue() {
      const items = await queue.getAll();
      if (items.length === 0) return;

      log.info('Flushing queue —', items.length, 'pending');
      await updateSyncStatus({ state: 'Syncing' });
      
      let hasError = false;
      let lastError = null;

      for (let i = items.length - 1; i >= 0; i--) {
        const { _queuedAt, _retries, ...data } = items[i];

        if (_retries >= MAX_RETRIES) {
          log.error('Dropping permanently failed:', data.problemTitle);
          await queue.remove(i);
          continue;
        }

        try {
          await sendToAPI(data);
          log.info('Activity synced from queue:', data.problemTitle);
          await queue.remove(i);
        } catch (err) {
          hasError = true;
          lastError = err.message;
          if (err.message === 'NO_TOKEN') break;
          
          if (err.status === 400 || err.status === 422 || err.status === 403 || err.status === 404) {
             log.error('Dropping invalid queue item:', err.message);
             await queue.remove(i);
             continue;
          }
          
          await queue.updateRetries(i, _retries + 1);
          log.warn(`Queue retry failed (${_retries + 1}/${MAX_RETRIES}):`, data.problemTitle);
        }
      }
      
      if (hasError) {
        await updateSyncStatus({ state: 'Offline', lastError });
      } else {
        await updateSyncStatus({ state: 'Idle', lastSuccess: Date.now() });
      }
    },

    // ── Debug Helpers ─────────────────────────────────────────────────

    async inspectQueue() {
      const items = await queue.getAll();
      log.info('Queue (' + items.length + '):', JSON.stringify(items, null, 2));
      return items;
    },

    async inspectRecentlySent() {
      const recent = await getRecentlySent();
      log.info('Recently sent:', JSON.stringify(recent, null, 2));
      return recent;
    },

    async clearQueue() {
      await queue.clear();
    },

    forceOffline() {
      self.__momentumForceOffline = true;
      log.info('Force offline mode ENABLED');
    },

    disableForceOffline() {
      self.__momentumForceOffline = false;
      log.info('Force offline mode DISABLED');
    },
  };
})();
