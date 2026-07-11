const workloadService = require('./workload.service');

const getWorkloadSummary = async (req, res, next) => {
  try {
    const summary = await workloadService.computeWorkloadSummary(req.user.userId);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWorkloadSummary,
};
