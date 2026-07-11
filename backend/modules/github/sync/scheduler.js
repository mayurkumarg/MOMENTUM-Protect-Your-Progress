// Lightweight backstop for the GitHub journal sync: no external queue/worker
// infra, just an in-process interval that re-queues anything left pending or
// failed. Runs once at boot (covers activities orphaned by a restart) and
// then periodically (covers transient GitHub outages / expired tokens that
// get reconnected later).

const syncService = require('./sync.service');

const INTERVAL_MS = 10 * 60 * 1000;
let timer = null;

const startSyncScheduler = () => {
  if (timer) return;

  syncService.requeueOutstanding().catch(() => {});

  timer = setInterval(() => {
    syncService.requeueOutstanding().catch(() => {});
  }, INTERVAL_MS);

  timer.unref?.();
};

module.exports = { startSyncScheduler };
