// Orchestrates syncing a solved DSA problem into the user's connected GitHub
// repo as one clean commit (problem file + journal index + regenerated
// README). Serializes writes per user (an in-memory queue) so two solves in
// quick succession never race on the same branch ref, and tracks status on
// the Activity document itself so retries are idempotent and crash-safe.

const Activity = require('../../activity/activity.model');
const githubService = require('../github.service');
const { commitFiles } = require('./githubWriter');
const { INDEX_PATH, README_PATH, buildProblemPath, buildProblemMarkdown, parseIndex, updateIndex, buildReadme } = require('./journal');

const MAX_ATTEMPTS = 5;
const STUCK_PENDING_MS = 3 * 60 * 1000; // don't re-queue a 'pending' row that's likely still in-flight

const userQueues = new Map();

// Runs `task` after any sync already queued for this user finishes, so
// GitHub ref updates for the same repo are never attempted concurrently.
const enqueueForUser = (userId, task) => {
  const key = String(userId);
  const previous = userQueues.get(key) || Promise.resolve();
  const next = previous.then(task, task).catch(() => {});
  userQueues.set(key, next);
  return next;
};

const markActivity = (activityId, patch) =>
  Activity.findByIdAndUpdate(activityId, { $set: { githubSync: patch } }).catch(() => {});

const runSync = async (userId, activityId) => {
  const activity = await Activity.findOne({ _id: activityId, userId });
  if (!activity) return;
  if (activity.githubSync?.status === 'synced') return; // already done — nothing to do

  const integration = await githubService.getActiveIntegration(userId);
  if (!integration) {
    await markActivity(activityId, {
      status: 'skipped',
      attempts: activity.githubSync?.attempts || 0,
      lastAttemptAt: new Date(),
      error: 'GitHub is not connected or no repository is selected.',
    });
    return;
  }

  const { token, repository } = integration;
  const path = buildProblemPath(activity);
  const attempts = (activity.githubSync?.attempts || 0) + 1;

  await markActivity(activityId, { status: 'pending', attempts, lastAttemptAt: new Date(), filePath: path });

  try {
    const result = await commitFiles({
      token,
      owner: repository.owner,
      repo: repository.name,
      branch: repository.defaultBranch || 'main',
      message: `Solved: ${activity.title} (${activity.metadata?.platform || 'Unknown'})`,
      buildFiles: async ({ readFile }) => {
        const [existingProblem, existingIndexRaw] = await Promise.all([readFile(path), readFile(INDEX_PATH)]);
        const index = updateIndex(parseIndex(existingIndexRaw), activity, path);

        return [
          { path, content: buildProblemMarkdown(activity, existingProblem) },
          { path: INDEX_PATH, content: JSON.stringify(index, null, 2) },
          { path: README_PATH, content: buildReadme(index) },
        ];
      },
    });

    await markActivity(activityId, {
      status: 'synced',
      attempts,
      lastAttemptAt: new Date(),
      commitSha: result.commitSha,
      filePath: path,
      error: null,
    });
  } catch (error) {
    await markActivity(activityId, {
      status: 'failed',
      attempts,
      lastAttemptAt: new Date(),
      filePath: path,
      error: (error.message || 'Unknown GitHub sync error').slice(0, 500),
    });
  }
};

const enqueueSync = (userId, activityId) => enqueueForUser(userId, () => runSync(userId, activityId));

// Backstop for process restarts / transient outages: re-queues anything left
// pending or failed (below the attempt cap) instead of retrying forever.
const requeueOutstanding = async () => {
  const cutoff = new Date(Date.now() - STUCK_PENDING_MS);

  const outstanding = await Activity.find({
    source: 'DSA',
    $or: [
      { 'githubSync.status': { $exists: false } }, // never attempted (e.g. process restarted right after creation)
      { 'githubSync.status': 'failed', 'githubSync.attempts': { $lt: MAX_ATTEMPTS } },
      { 'githubSync.status': 'pending', 'githubSync.lastAttemptAt': { $lte: cutoff } },
    ],
  }).select('_id userId');

  outstanding.forEach((activity) => enqueueSync(activity.userId, activity._id));
  return outstanding.length;
};

module.exports = { enqueueSync, requeueOutstanding };
