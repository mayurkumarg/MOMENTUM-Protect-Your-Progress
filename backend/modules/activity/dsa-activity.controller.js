const activityService = require('./activity.service');
const { ACTIVITY_SOURCE, ACTIVITY_TYPE } = require('./activity.model');

/**
 * DSA Activity Controller
 *
 * Handles incoming DSA problem-solved events from the browser extension.
 * Transforms the content-script payload (platform, problemTitle, url, solvedAt)
 * into the general Activity model format and persists it.
 */

const VALID_PLATFORMS = ['LeetCode', 'GFG'];

const createDsaActivity = async (req, res, next) => {
  try {
    const { platform, problemTitle, url, solvedAt } = req.body;

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

    // ── Map to Activity model fields ──────────────────────────────────
    const activityData = {
      source: ACTIVITY_SOURCE.DSA,
      activityType: ACTIVITY_TYPE.CODING,
      title: problemTitle,
      durationMinutes: 1, // default — extension doesn't track time
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
