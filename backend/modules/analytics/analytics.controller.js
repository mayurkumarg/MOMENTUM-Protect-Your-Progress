const analyticsService = require('./analytics.service');

const getAnalyticsSummary = async (req, res, next) => {
  try {
    const summary = await analyticsService.computeAnalyticsSummary(req.user.userId);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalyticsSummary,
};
