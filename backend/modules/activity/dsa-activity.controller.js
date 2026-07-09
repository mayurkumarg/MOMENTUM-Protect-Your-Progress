const activityService = require('./activity.service');
const Activity = require('./activity.model');
const { ACTIVITY_SOURCE, ACTIVITY_TYPE } = Activity;

/**
 * DSA Activity Controller
 *
 * Handles incoming DSA problem-solved events from the browser extension.
 * Transforms the content-script payload (platform, problemTitle, url, solvedAt)
 * into the general Activity model format and persists it.
 *
 * Includes server-side duplicate prevention:
 * same user + platform + problemTitle + same calendar day → 409 Conflict
 */

const VALID_PLATFORMS = [
  'LeetCode',
  'GFG',
  'Codeforces',
  'HackerRank',
  'CodeChef',
  'AtCoder',
  'InterviewBit',
];

const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 1440;

const resolveDurationMinutes = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_DURATION_MINUTES;
  return Math.min(Math.max(Math.round(parsed), MIN_DURATION_MINUTES), MAX_DURATION_MINUTES);
};

const resolveDurationSeconds = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.min(Math.round(parsed), MAX_DURATION_MINUTES * 60);
};

const createDsaActivity = async (req, res, next) => {
  try {
    const {
      platform,
      problemTitle,
      url,
      solvedAt,
      durationMinutes,
      durationSeconds,
      isEstimatedDuration,
      language,
      difficulty,
    } = req.body;

    // [Momentum][duration] temporary debug — remove after verifying the chain.
    console.log('[Momentum][duration] received:', {
      problemTitle,
      durationSeconds,
      durationMinutes,
      isEstimatedDuration,
    });

    // ── Validate required fields ──────────────────────────────────────
    const missing = [];
    if (!platform) missing.push('platform');
    if (!problemTitle) missing.push('problemTitle');
    if (!url) missing.push('url');
    if (!solvedAt) missing.push('solvedAt');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
      });
    }

    if (!VALID_PLATFORMS.includes(platform)) {
      return res.status(400).json({
        success: false,
        message: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`,
      });
    }

    const parsedDate = new Date(solvedAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid solvedAt date format.',
      });
    }

    // ── Duplicate prevention ──────────────────────────────────────────
    const startOfDay = new Date(parsedDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(parsedDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existing = await Activity.findOne({
      userId: req.user.userId,
      source: ACTIVITY_SOURCE.DSA,
      title: problemTitle,
      'metadata.platform': platform,
      activityDate: { $gte: startOfDay, $lte: endOfDay },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate activity — already recorded today.',
      });
    }

    // ── Map to Activity model fields ──────────────────────────────────
    const resolvedSeconds = resolveDurationSeconds(durationSeconds);
    const resolvedMinutes = resolvedSeconds
      ? Math.min(Math.max(Math.round(resolvedSeconds / 60), MIN_DURATION_MINUTES), MAX_DURATION_MINUTES)
      : resolveDurationMinutes(durationMinutes);

    const activityData = {
      source: ACTIVITY_SOURCE.DSA,
      activityType: ACTIVITY_TYPE.CODING,
      title: problemTitle,
      durationMinutes: resolvedMinutes,
      durationSeconds: resolvedSeconds || undefined,
      isEstimatedDuration: isEstimatedDuration === false ? false : true,
      activityDate: parsedDate,
      metadata: {
        platform,
        url,
        solvedAt: parsedDate.toISOString(),
        ...(language ? { language } : {}),
        ...(difficulty ? { difficulty } : {}),
      },
    };

    const activity = await activityService.createActivity(
      req.user.userId,
      activityData
    );

    // [Momentum][duration] temporary debug — remove after verifying the chain.
    console.log('[Momentum][duration] stored:', {
      title: activity.title,
      durationSeconds: activity.durationSeconds,
      durationMinutes: activity.durationMinutes,
      isEstimatedDuration: activity.isEstimatedDuration,
    });

    res.status(201).json({
      success: true,
      message: 'DSA activity saved successfully.',
      data: activity,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/dsa/summary
 *
 * A small "today" snapshot of the user's DSA activity — problems solved,
 * time spent, fastest/slowest solve, difficulty and platform breakdown,
 * and the most recent few solves. Scoped to the UTC calendar day, matching
 * the duplicate-check boundary used above.
 */
const DIFFICULTY_KEYS = ['Easy', 'Medium', 'Hard'];

const secondsOf = (activity) => activity.durationSeconds || activity.durationMinutes * 60;

const toSolveSummary = (activity) => ({
  title: activity.title,
  platform: (activity.metadata && activity.metadata.platform) || 'Unknown',
  durationSeconds: activity.durationSeconds || null,
  durationMinutes: activity.durationMinutes,
  isEstimatedDuration: activity.isEstimatedDuration !== false,
});

const getDsaSummary = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const todayActivities = await Activity.find({
      userId: req.user.userId,
      source: ACTIVITY_SOURCE.DSA,
      activityDate: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ activityDate: -1 });

    const problemsSolvedToday = todayActivities.length;
    const totalSeconds = todayActivities.reduce((sum, activity) => sum + secondsOf(activity), 0);
    const totalMinutesToday = Math.round(totalSeconds / 60);
    const avgSolveSeconds = problemsSolvedToday === 0 ? 0 : Math.round(totalSeconds / problemsSolvedToday);

    const difficultyCounts = { Easy: 0, Medium: 0, Hard: 0, Unknown: 0 };
    const platformCounts = {};
    let fastestRaw = null;
    let fastestSeconds = Infinity;
    let slowestRaw = null;
    let slowestSeconds = -Infinity;

    for (const activity of todayActivities) {
      const seconds = secondsOf(activity);

      if (seconds < fastestSeconds) {
        fastestSeconds = seconds;
        fastestRaw = activity;
      }
      if (seconds > slowestSeconds) {
        slowestSeconds = seconds;
        slowestRaw = activity;
      }

      const difficulty = activity.metadata && activity.metadata.difficulty;
      const difficultyKey = DIFFICULTY_KEYS.includes(difficulty) ? difficulty : 'Unknown';
      difficultyCounts[difficultyKey] += 1;

      const platform = (activity.metadata && activity.metadata.platform) || 'Unknown';
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    }

    res.status(200).json({
      success: true,
      data: {
        date: startOfDay.toISOString().slice(0, 10),
        problemsSolvedToday,
        totalMinutesToday,
        avgSolveSeconds,
        fastestSolve: fastestRaw ? toSolveSummary(fastestRaw) : null,
        slowestSolve: slowestRaw ? toSolveSummary(slowestRaw) : null,
        difficultyCounts,
        platformCounts,
        recent: todayActivities.slice(0, 5).map(toSolveSummary),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDsaActivity,
  getDsaSummary,
};
