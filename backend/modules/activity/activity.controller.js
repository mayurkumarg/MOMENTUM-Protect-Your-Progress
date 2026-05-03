const activityService = require('./activity.service');

const MOCK_USER_ID = '665f1f1f1f1f1f1f1f1f1f1f';

const sendSuccess = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const createActivity = async (req, res, next) => {
  try {
    const activity = await activityService.createActivity(MOCK_USER_ID, req.body);
    sendSuccess(res, 201, activity);
  } catch (error) {
    next(error);
  }
};

const getActivities = async (req, res, next) => {
  try {
    const activities = await activityService.getActivities(MOCK_USER_ID, req.query);
    sendSuccess(res, 200, activities);
  } catch (error) {
    next(error);
  }
};

const getActivityById = async (req, res, next) => {
  try {
    const activity = await activityService.getActivityById(MOCK_USER_ID, req.params.id);
    sendSuccess(res, 200, activity);
  } catch (error) {
    next(error);
  }
};

const updateActivity = async (req, res, next) => {
  try {
    const activity = await activityService.updateActivity(MOCK_USER_ID, req.params.id, req.body);
    sendSuccess(res, 200, activity);
  } catch (error) {
    next(error);
  }
};

const deleteActivity = async (req, res, next) => {
  try {
    const activity = await activityService.deleteActivity(MOCK_USER_ID, req.params.id);
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
