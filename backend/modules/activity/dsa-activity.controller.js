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

const createDsaActivity = async (req, res, next) => {
  try {
    const { platform, problemTitle, url, solvedAt, durationMinutes } = req.body;

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
    const activityData = {
      source: ACTIVITY_SOURCE.DSA,
      activityType: ACTIVITY_TYPE.CODING,
      title: problemTitle,
      durationMinutes: resolveDurationMinutes(durationMinutes),
      activityDate: parsedDate,
      metadata: {
        platform,
        url,
        solvedAt: parsedDate.toISOString(),
      },
    };

    const activity = await activityService.createActivity(
      req.user.userId,
      activityData
    );

    res.status(201).json({
      success: true,
      message: 'DSA activity saved successfully.',
      data: activity,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDsaActivity,
};
