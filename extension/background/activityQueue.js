/**
 * Offline Activity Queue
 * Persists failed activities to chrome.storage.local for retry.
 * Auto-cleans to prevent unbounded storage growth.
 */
(function () {
  const log = self.MomentumLogger;
  const STORAGE_KEY = 'pendingActivities';
  const MAX_QUEUE_SIZE = 50;

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
      log.info('Queued offline activity:', activity.problemTitle);
    },

    async remove(index) {
      const queue = await this.getAll();
      if (index >= 0 && index < queue.length) {
        queue.splice(index, 1);
        await chrome.storage.local.set({ [STORAGE_KEY]: queue });
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
      log.info('Queue cleared');
    },

    async size() {
      const queue = await this.getAll();
      return queue.length;
    },
  };
})();
