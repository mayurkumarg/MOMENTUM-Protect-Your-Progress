const mongoose = require('mongoose');
const Task = require('../task/task.model');
const Activity = require('../activity/activity.model');
const AppError = require('../../utils/AppError');
const { DAY_MS, formatDateKey, computeCurrentStreakDays } = require('../../utils/dateStats');

const { TASK_STATUS } = Task;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const assertValidObjectId = (id, label = 'id') => {
  if (!isValidObjectId(id)) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
};

// Simple, rule-based thresholds — deliberately not a predictive model.
const THRESHOLDS = {
  WORKLOAD_HOURS_MODERATE: 8,
  WORKLOAD_HOURS_HIGH: 20,
  WORKLOAD_TASKS_MODERATE: 4,
  WORKLOAD_TASKS_HIGH: 8,
  DUE_SOON_DAYS: 3,
  LOOKBACK_DAYS: 14,
  STREAK_GOOD_DAYS: 3,
};

const classifyWorkloadLevel = (totalEstimatedHours, openTasksCount) => {
  if (totalEstimatedHours >= THRESHOLDS.WORKLOAD_HOURS_HIGH || openTasksCount >= THRESHOLDS.WORKLOAD_TASKS_HIGH) {
    return 'High';
  }
  if (totalEstimatedHours >= THRESHOLDS.WORKLOAD_HOURS_MODERATE || openTasksCount >= THRESHOLDS.WORKLOAD_TASKS_MODERATE) {
    return 'Moderate';
  }
  return 'Low';
};

const classifyScheduleTightness = (overdueTasksCount, dueSoonCount) => {
  if (overdueTasksCount > 0) return 'Critical';
  if (dueSoonCount > 0) return 'Tight';
  return 'Relaxed';
};

const classifyTaskConsistency = (currentStreakDays, activeDaysLast7) => {
  if (currentStreakDays === 0 && activeDaysLast7 <= 1) return 'Needs Attention';
  if (currentStreakDays < THRESHOLDS.STREAK_GOOD_DAYS && activeDaysLast7 < 4) return 'Building';
  return 'On Track';
};

const classifyOverloadStatus = (workloadLevel, scheduleTightness) => {
  if (workloadLevel === 'High' && scheduleTightness === 'Critical') return 'Overloaded';
  if (workloadLevel === 'High' || scheduleTightness === 'Critical') return 'Stretched';
  if (workloadLevel === 'Low' && scheduleTightness === 'Relaxed') return 'Light';
  return 'Balanced';
};

const computeWorkloadSummary = async (userId) => {
  assertValidObjectId(userId, 'userId');

  const now = new Date();
  const dueSoonCutoff = new Date(now.getTime() + THRESHOLDS.DUE_SOON_DAYS * DAY_MS);
  const lookbackCutoff = new Date(now.getTime() - THRESHOLDS.LOOKBACK_DAYS * DAY_MS);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

  const [openTasks, recentActivity, completedTasksLast7] = await Promise.all([
    Task.find({ userId, status: TASK_STATUS.PENDING }).select('deadline estimatedHours'),
    Activity.find({ userId, activityDate: { $gte: lookbackCutoff } }).select('activityDate'),
    Task.countDocuments({ userId, status: TASK_STATUS.COMPLETED, completedAt: { $gte: sevenDaysAgo } }),
  ]);

  const overdueTasksCount = openTasks.filter((task) => task.deadline < now).length;
  const dueSoonCount = openTasks.filter((task) => task.deadline >= now && task.deadline <= dueSoonCutoff).length;
  const totalEstimatedHours = openTasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);

  const activityDayKeys = new Set(recentActivity.map((activity) => formatDateKey(activity.activityDate)));
  const currentStreakDays = computeCurrentStreakDays(activityDayKeys);
  const sevenDaysAgoKey = formatDateKey(sevenDaysAgo);
  const activeDaysLast7 = [...activityDayKeys].filter((key) => key >= sevenDaysAgoKey).length;

  const workloadLevel = classifyWorkloadLevel(totalEstimatedHours, openTasks.length);
  const scheduleTightness = classifyScheduleTightness(overdueTasksCount, dueSoonCount);
  const taskConsistency = classifyTaskConsistency(currentStreakDays, activeDaysLast7);
  const overloadStatus = classifyOverloadStatus(workloadLevel, scheduleTightness);

  return {
    workloadLevel,
    scheduleTightness,
    taskConsistency,
    overloadStatus,
    metrics: {
      openTasksCount: openTasks.length,
      overdueTasksCount,
      dueSoonCount,
      totalEstimatedHours,
      currentStreakDays,
      activeDaysLast7,
      completedTasksLast7,
    },
  };
};

module.exports = {
  AppError,
  computeWorkloadSummary,
};
