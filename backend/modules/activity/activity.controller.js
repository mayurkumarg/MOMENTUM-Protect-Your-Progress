const activityService = require('./activity.service');

const sendSuccess = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const createActivity = async (req, res, next) => {
  try {
    const activity = await activityService.createActivity(req.user.userId, req.body);
    sendSuccess(res, 201, activity);
  } catch (error) {
    next(error);
  }
};

const getActivities = async (req, res, next) => {
  try {
    const activities = await activityService.getActivities(req.user.userId, req.query);
    sendSuccess(res, 200, activities);
  } catch (error) {
    next(error);
  }
};

const getActivityById = async (req, res, next) => {
  try {
    const activity = await activityService.getActivityById(req.user.userId, req.params.id);
    sendSuccess(res, 200, activity);
  } catch (error) {
    next(error);
  }
};

const updateActivity = async (req, res, next) => {
  try {
    const activity = await activityService.updateActivity(req.user.userId, req.params.id, req.body);
    sendSuccess(res, 200, activity);
  } catch (error) {
    next(error);
  }
};

const deleteActivity = async (req, res, next) => {
  try {
    const activity = await activityService.deleteActivity(req.user.userId, req.params.id);
    sendSuccess(res, 200, activity);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
};
