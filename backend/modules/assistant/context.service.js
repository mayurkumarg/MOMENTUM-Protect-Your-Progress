// Assembles a compact snapshot of the user's Momentum workspace for the AI
// assistant to reason over. It deliberately REUSES the existing read-side
// services (workload, analytics, github) and the same models everything else
// reads from — no new storage, no new computations that could drift from what
// the rest of the app shows the user.
//
// Every section is gathered independently and fails soft: one slow or broken
// data source yields `null` for that section (surfaced to the model as
// "unavailable") instead of breaking the whole conversation.

const mongoose = require('mongoose');
const Task = require('../task/task.model');
const Activity = require('../activity/activity.model');
const Note = require('../notes/notes.model');
const workloadService = require('../workload/workload.service');
const analyticsService = require('../analytics/analytics.service');
const githubService = require('../github/github.service');
const companyService = require('../companies/company.service');
const { DAY_MS, formatDateKey } = require('../../utils/dateStats');

const { TASK_STATUS } = Task;
const { ACTIVITY_SOURCE } = Activity;

const OPEN_TASK_LIMIT = 15;
const COMPLETED_LIMIT = 15;
const RECENT_ACTIVITY_LIMIT = 8;
const DIFFICULTY_KEYS = ['Easy', 'Medium', 'Hard'];
const COMPANY_LIMIT = 20;
const PENDING_TASK_PREVIEW_LIMIT = 5;
const NOTE_TITLE_LIMIT = 5;
const UPCOMING_DATE_LIMIT = 3;

// Never let one section's failure sink the whole context — the assistant is
// still useful with partial data, and the prompt tells the model to say when
// something is missing.
const safe = async (label, fn) => {
  try {
    return await fn();
  } catch (error) {
    console.error(`[assistant] context section "${label}" failed:`, error.message);
    return null;
  }
};

const daysBetween = (from, to) => Math.round((to.getTime() - from.getTime()) / DAY_MS);

const summarizeTask = (task, now) => {
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const isOpen = task.status !== TASK_STATUS.COMPLETED;
  return {
    title: task.title,
    status: task.status,
    priority: task.priority,
    category: task.category || null,
    estimatedHours: task.estimatedHours,
    deadline: deadline ? formatDateKey(deadline) : null,
    daysUntilDeadline: deadline ? daysBetween(now, deadline) : null,
    overdue: Boolean(deadline && isOpen && deadline < now),
    subtaskProgressPct: task.subtasks && task.subtasks.length > 0
      ? Math.round((task.subtasks.filter((s) => s.isCompleted).length / task.subtasks.length) * 100)
      : null,
  };
};

const buildTasksContext = async (userId, now) => {
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

  const [openTasks, completedThisWeek] = await Promise.all([
    Task.find({ userId, status: { $in: [TASK_STATUS.PENDING, TASK_STATUS.IN_PROGRESS] } })
      .sort({ deadline: 1 })
      .limit(OPEN_TASK_LIMIT),
    Task.find({ userId, status: TASK_STATUS.COMPLETED, completedAt: { $gte: sevenDaysAgo } })
      .sort({ completedAt: -1 })
      .limit(COMPLETED_LIMIT),
  ]);

  const open = openTasks.map((task) => summarizeTask(task, now));

  return {
    openCount: open.length,
    overdueCount: open.filter((task) => task.overdue).length,
    dueSoonCount: open.filter((task) => task.daysUntilDeadline !== null && !task.overdue && task.daysUntilDeadline <= 3).length,
    open,
    completedThisWeek: completedThisWeek.map((task) => ({
      title: task.title,
      priority: task.priority,
      category: task.category || null,
      completedAt: task.completedAt ? formatDateKey(task.completedAt) : null,
    })),
  };
};

const buildDsaTodayContext = async (userId, now) => {
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const todays = await Activity.find({
    userId,
    source: ACTIVITY_SOURCE.DSA,
    activityDate: { $gte: startOfDay, $lte: endOfDay },
  }).sort({ activityDate: -1 });

  const difficultyCounts = { Easy: 0, Medium: 0, Hard: 0, Unknown: 0 };
  const platformCounts = {};
  let totalSeconds = 0;

  for (const activity of todays) {
    totalSeconds += activity.durationSeconds || activity.durationMinutes * 60;
    const difficulty = activity.metadata && activity.metadata.difficulty;
    difficultyCounts[DIFFICULTY_KEYS.includes(difficulty) ? difficulty : 'Unknown'] += 1;
    const platform = (activity.metadata && activity.metadata.platform) || 'Unknown';
    platformCounts[platform] = (platformCounts[platform] || 0) + 1;
  }

  return {
    date: formatDateKey(startOfDay),
    problemsSolvedToday: todays.length,
    totalMinutesToday: Math.round(totalSeconds / 60),
    difficultyCounts,
    platformCounts,
    recent: todays.slice(0, 5).map((activity) => ({
      title: activity.title,
      platform: (activity.metadata && activity.metadata.platform) || 'Unknown',
      difficulty: (activity.metadata && activity.metadata.difficulty) || 'Unknown',
    })),
  };
};

const buildRecentActivityContext = async (userId) => {
  const recent = await Activity.find({ userId })
    .sort({ activityDate: -1 })
    .limit(RECENT_ACTIVITY_LIMIT);

  return recent.map((activity) => ({
    title: activity.title,
    source: activity.source,
    activityType: activity.activityType,
    durationMinutes: activity.durationMinutes,
    date: formatDateKey(activity.activityDate),
    platform: (activity.metadata && activity.metadata.platform) || null,
  }));
};

const buildAnalyticsContext = async (userId) => {
  const summary = await analyticsService.computeAnalyticsSummary(userId);
  // Trim the heatmap (98 daily cells) out — the model doesn't need per-day
  // granularity, just the headline signals.
  return {
    range: summary.range,
    streak: summary.streak,
    weeklyComparison: summary.weeklyComparison,
    platformBreakdown: summary.platformBreakdown,
    taskCompletion: summary.taskCompletion,
    totals: summary.totals,
  };
};

const buildGithubContext = async (userId) => {
  const [status, synced, pending, failed] = await Promise.all([
    githubService.getStatus(userId),
    Activity.countDocuments({ userId, source: ACTIVITY_SOURCE.DSA, 'githubSync.status': 'synced' }),
    Activity.countDocuments({ userId, source: ACTIVITY_SOURCE.DSA, 'githubSync.status': 'pending' }),
    Activity.countDocuments({ userId, source: ACTIVITY_SOURCE.DSA, 'githubSync.status': 'failed' }),
  ]);

  return {
    connected: status.connected,
    username: status.githubUsername || null,
    repository: status.repository ? status.repository.fullName || status.repository.name : null,
    sync: { synced, pending, failed },
  };
};

// Placement Tracker section — reuses companyService.getCompanies (the exact
// same read the Placements page uses) and companyService.computePlacementSummary
// for the headline counts, then cross-references linked tasks and notes with
// direct, read-only queries (same style buildTasksContext/buildGithubContext
// already use) rather than a new endpoint. Per-company detail is deliberately
// light (titles/counts, not full note bodies or every linked task) to keep
// the prompt bounded even with many companies.
const buildPlacementsContext = async (userId, now) => {
  const companies = await companyService.getCompanies(userId);
  const summary = companyService.computePlacementSummary(companies, now);

  const recentCompanies = companies.slice(0, COMPANY_LIMIT);
  if (recentCompanies.length === 0) {
    return { summary, companies: [] };
  }

  const companyIds = recentCompanies.map((company) => company.id);

  const [linkedTasks, companyNotes] = await Promise.all([
    Task.find({ userId, companyId: { $in: companyIds } }).select('title status companyId'),
    Note.find({ userId, entityType: 'COMPANY', entityId: { $in: companyIds } })
      .select('entityId title updatedAt')
      .sort({ updatedAt: -1 }),
  ]);

  const tasksByCompany = new Map();
  for (const task of linkedTasks) {
    const key = String(task.companyId);
    if (!tasksByCompany.has(key)) tasksByCompany.set(key, []);
    tasksByCompany.get(key).push(task);
  }

  const notesByCompany = new Map();
  for (const note of companyNotes) {
    const key = String(note.entityId);
    if (!notesByCompany.has(key)) notesByCompany.set(key, []);
    notesByCompany.get(key).push(note);
  }

  const companiesContext = recentCompanies.map((company) => {
    const linked = tasksByCompany.get(String(company.id)) || [];
    const pendingTasks = linked.filter((task) => task.status !== TASK_STATUS.COMPLETED);
    const completedCount = linked.length - pendingTasks.length;
    const notesForCompany = notesByCompany.get(String(company.id)) || [];

    const upcomingDates = (company.importantDates || [])
      .filter((entry) => entry.date && new Date(entry.date) >= now)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, UPCOMING_DATE_LIMIT)
      .map((entry) => ({ label: entry.label, date: formatDateKey(entry.date) }));

    return {
      name: company.name,
      role: company.role || null,
      location: company.location || null,
      packageInfo: company.packageInfo || null,
      status: company.status,
      resumeVersion: company.resumeVersion || null,
      applicationDate: company.applicationDate ? formatDateKey(company.applicationDate) : null,
      upcomingDates,
      prepProgressPct: linked.length > 0 ? Math.round((completedCount / linked.length) * 100) : null,
      pendingTaskCount: pendingTasks.length,
      pendingTaskTitles: pendingTasks.slice(0, PENDING_TASK_PREVIEW_LIMIT).map((task) => task.title),
      noteCount: notesForCompany.length,
      noteTitles: notesForCompany.slice(0, NOTE_TITLE_LIMIT).map((note) => note.title || 'Untitled note'),
    };
  });

  return { summary, companies: companiesContext };
};

// Builds the full workspace snapshot. Sections run in parallel and independently;
// a `null` section means "couldn't load this", which the prompt turns into an
// explicit "information unavailable" rather than a silent gap.
const buildUserContext = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Invalid userId for assistant context.');
  }

  const now = new Date();

  const [workload, tasks, dsaToday, recentActivity, analytics, github, placements] = await Promise.all([
    safe('workload', () => workloadService.computeWorkloadSummary(userId)),
    safe('tasks', () => buildTasksContext(userId, now)),
    safe('dsaToday', () => buildDsaTodayContext(userId, now)),
    safe('recentActivity', () => buildRecentActivityContext(userId)),
    safe('analytics', () => buildAnalyticsContext(userId)),
    safe('github', () => buildGithubContext(userId)),
    safe('placements', () => buildPlacementsContext(userId, now)),
  ]);

  return {
    generatedAt: now.toISOString(),
    workload,
    tasks,
    dsaToday,
    recentActivity,
    analytics,
    github,
    placements,
  };
};

module.exports = {
  buildUserContext,
};
