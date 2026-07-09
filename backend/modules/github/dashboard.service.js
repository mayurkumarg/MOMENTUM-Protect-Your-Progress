// Read-side for the GitHub Activity dashboard: combines the connection/repo
// status (github.service) with sync counts, consistency, and recent items
// pulled off the Activity collection's githubSync field (populated by
// modules/github/sync), plus real commit history from GitHub itself.
// No new storage — this is just a purpose-built view over existing data.

const Activity = require('../activity/activity.model');
const githubService = require('./github.service');
const syncService = require('./sync/sync.service');

const RECENT_LIMIT = 8;
const ATTENTION_LIMIT = 5;
const STREAK_LOOKBACK_LIMIT = 400; // enough history for any realistic streak, bounded query

const EMPTY_STATS = { totalDsaActivities: 0, synced: 0, pending: 0, failed: 0, skipped: 0, lastSyncedAt: null };
const EMPTY_CONSISTENCY = { currentStreak: 0, longestStreak: 0, last7Days: [] };

const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

const buildCommitUrl = (repository, commitSha) =>
  repository?.htmlUrl && commitSha ? `${repository.htmlUrl}/commit/${commitSha}` : null;

const buildFileUrl = (repository, filePath) =>
  repository?.htmlUrl && filePath ? `${repository.htmlUrl}/blob/${repository.defaultBranch || 'main'}/${filePath}` : null;

const toEntry = (activity, repository) => ({
  id: activity._id,
  title: activity.title,
  platform: activity.metadata?.platform || 'Unknown',
  difficulty: activity.metadata?.difficulty || 'Unknown',
  solvedAt: activity.activityDate,
  syncedAt: activity.githubSync?.lastAttemptAt || null,
  commitUrl: buildCommitUrl(repository, activity.githubSync?.commitSha),
  fileUrl: buildFileUrl(repository, activity.githubSync?.filePath),
  error: activity.githubSync?.error || null,
});

// "Coding consistency" — current/longest streak of days with at least one
// problem synced to GitHub, plus a 7-day strip for an at-a-glance view.
// Deliberately simple (day-level presence, not hour-by-hour) to stay a quick
// read rather than a second heatmap.
const computeConsistency = (solvedDates) => {
  const countsByDay = new Map();
  for (const date of solvedDates) {
    const key = dayKey(date);
    countsByDay.set(key, (countsByDay.get(key) || 0) + 1);
  }

  let currentStreak = 0;
  const cursor = new Date();
  while (countsByDay.has(dayKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sortedDays = [...countsByDay.keys()].sort();
  let longestStreak = 0;
  let running = 0;
  let prevDay = null;
  for (const key of sortedDays) {
    const day = new Date(key);
    running = prevDay && Math.round((day - prevDay) / 86400000) === 1 ? running + 1 : 1;
    longestStreak = Math.max(longestStreak, running);
    prevDay = day;
  }

  const last7Days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    last7Days.push({ date: key, count: countsByDay.get(key) || 0 });
  }

  return { currentStreak, longestStreak, last7Days };
};

const getActivityDashboard = async (userId) => {
  const status = await githubService.getStatus(userId);
  const repository = status.repository;

  if (!repository) {
    return { ...status, stats: EMPTY_STATS, consistency: EMPTY_CONSISTENCY, weeklyComparison: { thisWeek: 0, lastWeek: 0 }, recentSynced: [], needsAttention: [], recentCommits: [] };
  }

  const now = new Date();
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - 6);
  startOfThisWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

  const [
    totalDsa,
    synced,
    pending,
    failed,
    skipped,
    recentSynced,
    needsAttention,
    streakDates,
    thisWeekCount,
    lastWeekCount,
    recentCommits,
  ] = await Promise.all([
    Activity.countDocuments({ userId, source: 'DSA' }),
    Activity.countDocuments({ userId, source: 'DSA', 'githubSync.status': 'synced' }),
    Activity.countDocuments({ userId, source: 'DSA', 'githubSync.status': 'pending' }),
    Activity.countDocuments({ userId, source: 'DSA', 'githubSync.status': 'failed' }),
    Activity.countDocuments({ userId, source: 'DSA', 'githubSync.status': 'skipped' }),
    Activity.find({ userId, source: 'DSA', 'githubSync.status': 'synced' }).sort({ 'githubSync.lastAttemptAt': -1 }).limit(RECENT_LIMIT),
    Activity.find({ userId, source: 'DSA', 'githubSync.status': 'failed' }).sort({ 'githubSync.lastAttemptAt': -1 }).limit(ATTENTION_LIMIT),
    Activity.find({ userId, source: 'DSA', 'githubSync.status': 'synced' }).sort({ activityDate: -1 }).limit(STREAK_LOOKBACK_LIMIT).select('activityDate'),
    Activity.countDocuments({ userId, source: 'DSA', 'githubSync.status': 'synced', activityDate: { $gte: startOfThisWeek } }),
    Activity.countDocuments({ userId, source: 'DSA', 'githubSync.status': 'synced', activityDate: { $gte: startOfLastWeek, $lt: startOfThisWeek } }),
    githubService.listRecentCommits(userId),
  ]);

  return {
    ...status,
    stats: {
      totalDsaActivities: totalDsa,
      synced,
      pending,
      failed,
      skipped,
      lastSyncedAt: recentSynced[0]?.githubSync?.lastAttemptAt || null,
    },
    consistency: computeConsistency(streakDates.map((activity) => activity.activityDate)),
    weeklyComparison: { thisWeek: thisWeekCount, lastWeek: lastWeekCount },
    recentSynced: recentSynced.map((activity) => toEntry(activity, repository)),
    needsAttention: needsAttention.map((activity) => toEntry(activity, repository)),
    recentCommits,
  };
};

const retrySync = async (userId, activityId) => {
  const activity = await Activity.findOne({ _id: activityId, userId, source: 'DSA' });
  if (!activity || activity.githubSync?.status !== 'failed') return false;

  syncService.enqueueSync(userId, activity._id);
  return true;
};

module.exports = { getActivityDashboard, retrySync };
