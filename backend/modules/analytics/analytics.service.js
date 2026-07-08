const mongoose = require('mongoose');
const Task = require('../task/task.model');
const Activity = require('../activity/activity.model');
const AppError = require('../../utils/AppError');
const { DAY_MS, startOfDay, formatDateKey, computeCurrentStreakDays, computeLongestStreakDays } = require('../../utils/dateStats');

const { TASK_STATUS } = Task;
const { ACTIVITY_SOURCE } = Activity;

// 14 full weeks — enough for a GitHub-style contribution grid without an unbounded scan.
const WINDOW_DAYS = 98;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const assertValidObjectId = (id, label = 'id') => {
  if (!isValidObjectId(id)) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
};

const computeAnalyticsSummary = async (userId) => {
  assertValidObjectId(userId, 'userId');

  const now = new Date();
  const windowStart = new Date(startOfDay(now).getTime() - (WINDOW_DAYS - 1) * DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);

  const [windowActivity, allTasks] = await Promise.all([
    Activity.find({ userId, activityDate: { $gte: windowStart } }).select('activityDate durationMinutes source metadata'),
    Task.find({ userId }).select('status deadline'),
  ]);

  // ── Heatmap (also feeds streak calculations) ──
  const countsByDay = new Map();
  windowActivity.forEach((activity) => {
    const key = formatDateKey(activity.activityDate);
    countsByDay.set(key, (countsByDay.get(key) || 0) + 1);
  });

  const heatmap = [];
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    const date = new Date(windowStart.getTime() + i * DAY_MS);
    const key = formatDateKey(date);
    heatmap.push({ date: key, count: countsByDay.get(key) || 0 });
  }

  const activityDayKeys = new Set(countsByDay.keys());
  const streak = {
    current: computeCurrentStreakDays(activityDayKeys),
    longest: computeLongestStreakDays(activityDayKeys, WINDOW_DAYS, now),
  };

  // ── Weekly comparison ──
  const thisWeekCount = windowActivity.filter((activity) => activity.activityDate >= sevenDaysAgo).length;
  const lastWeekCount = windowActivity.filter(
    (activity) => activity.activityDate >= fourteenDaysAgo && activity.activityDate < sevenDaysAgo
  ).length;
  const deltaPct = lastWeekCount === 0
    ? (thisWeekCount > 0 ? 100 : 0)
    : Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);

  const weeklyComparison = { thisWeek: thisWeekCount, lastWeek: lastWeekCount, deltaPct };

  // ── Platform breakdown ──
  const platformCounts = new Map();
  windowActivity
    .filter((activity) => activity.source === ACTIVITY_SOURCE.DSA && activity.metadata?.platform)
    .forEach((activity) => {
      const { platform } = activity.metadata;
      platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1);
    });

  const platformBreakdown = [...platformCounts.entries()]
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);

  // ── Task completion (all-time snapshot, not window-limited) ──
  const completed = allTasks.filter((task) => task.status === TASK_STATUS.COMPLETED).length;
  const overdue = allTasks.filter((task) => task.status === TASK_STATUS.PENDING && task.deadline < now).length;
  const pending = allTasks.filter((task) => task.status === TASK_STATUS.PENDING && task.deadline >= now).length;
  const total = allTasks.length;
  const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);

  const taskCompletion = { completed, pending, overdue, total, completionRate };

  // ── Totals ──
  const totals = {
    totalActivities: windowActivity.length,
    totalMinutes: windowActivity.reduce((sum, activity) => sum + (activity.durationMinutes || 0), 0),
    activeDays: activityDayKeys.size,
  };

  return {
    range: { days: WINDOW_DAYS, from: formatDateKey(windowStart), to: formatDateKey(now) },
    heatmap,
    streak,
    weeklyComparison,
    platformBreakdown,
    taskCompletion,
    totals,
  };
};

module.exports = {
  AppError,
  computeAnalyticsSummary,
};
