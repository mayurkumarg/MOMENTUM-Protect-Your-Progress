/**
 * Activity Manager — Core Orchestrator
 *
 * Responsibilities:
 * - Deduplication (session + storage + cooldown)
 * - Retry with exponential backoff (max 5 retries)
 * - Offline queue integration
 * - API communication
 * - Debug helpers
 */
(function () {
  const log = self.MomentumLogger;
  const queue = self.ActivityQueue;

  const API_URL = 'http://localhost:5000/api/dsa/activity';
  const COOLDOWN_MS = 30 * 1000;
  const MAX_RETRIES = 5;
  const RECENTLY_SENT_KEY = 'recentlySent';
  const MAX_RECENT = 100;
  const RECENT_TTL_MS = 24 * 60 * 60 * 1000;

  // In-memory dedup for current service worker session
  const sessionKeys = new Set();

  // ── Helpers ──────────────────────────────────────────────────────────

  function generateKey(data) {
    const date = new Date(data.solvedAt).toISOString().split('T')[0];
    return `${data.platform}-${data.problemTitle}-${date}`;
  }

  async function getRecentlySent() {
    const result = await chrome.storage.local.get(RECENTLY_SENT_KEY);
    return result[RECENTLY_SENT_KEY] || {};
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

    await chrome.storage.local.set({ [RECENTLY_SENT_KEY]: trimmed });
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

  async function getToken() {
    const result = await chrome.storage.local.get('token');
    return result.token || null;
  }

  // ── API Communication ───────────────────────────────────────────────

  async function sendToAPI(data) {
    if (self.__momentumForceOffline) {
      throw new Error('FORCE_OFFLINE');
    }

    const token = await getToken();
    if (!token) throw new Error('NO_TOKEN');

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (res.status === 409) {
      log.info('Backend duplicate — already saved:', data.problemTitle);
      return result;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${result.message || 'Unknown error'}`);
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
        if (err.message === 'NO_TOKEN') throw err;

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

      try {
        const result = await sendWithRetry(data);
        await markAsSent(key);
        log.info('Activity synced:', data.problemTitle);
        return result;
      } catch (err) {
        if (err.message === 'NO_TOKEN') {
          log.error('No token — user not logged in');
          return;
        }
        await queue.enqueue(data);
        await markAsSent(key);
      }
    },

    async flushQueue() {
      const items = await queue.getAll();
      if (items.length === 0) return;

      log.info('Flushing queue —', items.length, 'pending');

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
          if (err.message === 'NO_TOKEN') return;
          await queue.updateRetries(i, _retries + 1);
          log.warn(`Queue retry failed (${_retries + 1}/${MAX_RETRIES}):`, data.problemTitle);
        }
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
