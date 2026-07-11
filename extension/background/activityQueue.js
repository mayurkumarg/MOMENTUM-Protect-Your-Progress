/**
 * Offline Activity Queue
 * Persists failed activities to chrome.storage.local for retry.
 * Auto-cleans to prevent unbounded storage growth.
 *
 * Requires:
 *   config/constants.js        (self.__MomentumConfig)
 *   background/logger.js       (self.MomentumLogger)
 */
(function () {
  const log = self.MomentumLogger;
  const config = self.__MomentumConfig;
  const STORAGE_KEY = config.STORAGE_KEYS.PENDING_ACTIVITIES;
  const MAX_QUEUE_SIZE = config.TIMING.MAX_QUEUE_SIZE;
  const STATUS_KEY = config.STORAGE_KEYS.SYNC_STATUS;

  async function updatePendingCount(count) {
    const res = await chrome.storage.local.get(STATUS_KEY);
    const status = res[STATUS_KEY] || { state: 'Idle', lastSuccess: null, lastError: null, pendingCount: 0 };
    if (status.pendingCount !== count) {
      status.pendingCount = count;
      await chrome.storage.local.set({ [STATUS_KEY]: status });
    }
  }

  self.ActivityQueue = {
    async getAll() {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || [];
    },

    async enqueue(activity) {
      const queue = await this.getAll();
      queue.push({
        ...activity,
        _queuedAt: Date.now(),
        _retries: 0,
      });

      // Drop oldest entries if queue exceeds max size
      if (queue.length > MAX_QUEUE_SIZE) {
        const dropped = queue.splice(0, queue.length - MAX_QUEUE_SIZE);
        log.warn('Queue overflow — dropped', dropped.length, 'oldest entries');
      }

      await chrome.storage.local.set({ [STORAGE_KEY]: queue });
      await updatePendingCount(queue.length);
      log.info('Queued offline activity:', activity.problemTitle);
    },

    async remove(index) {
      const queue = await this.getAll();
      if (index >= 0 && index < queue.length) {
        queue.splice(index, 1);
        await chrome.storage.local.set({ [STORAGE_KEY]: queue });
        await updatePendingCount(queue.length);
      }
    },

    async updateRetries(index, retries) {
      const queue = await this.getAll();
      if (queue[index]) {
        queue[index]._retries = retries;
        await chrome.storage.local.set({ [STORAGE_KEY]: queue });
      }
    },

    async clear() {
      await chrome.storage.local.set({ [STORAGE_KEY]: [] });
      await updatePendingCount(0);
      log.info('Queue cleared');
    },

    async size() {
      const queue = await this.getAll();
      return queue.length;
    },
  };
})();
