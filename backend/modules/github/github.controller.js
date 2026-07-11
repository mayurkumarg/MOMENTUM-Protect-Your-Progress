const mongoose = require('mongoose');
const githubService = require('./github.service');
const dashboardService = require('./dashboard.service');
const AppError = require('../../utils/AppError');

const REPO_NAME_PATTERN = /^[a-zA-Z0-9_.-]{1,100}$/;

const sendSuccess = (res, statusCode, data) => {
  res.status(statusCode).json({ success: true, data });
};

const getStatus = async (req, res, next) => {
  try {
    const status = await githubService.getStatus(req.user.userId);
    return sendSuccess(res, 200, status);
  } catch (error) {
    next(error);
  }
};

const listRepos = async (req, res, next) => {
  try {
    const repos = await githubService.listRepos(req.user.userId);
    return sendSuccess(res, 200, repos);
  } catch (error) {
    next(error);
  }
};

const createRepo = async (req, res, next) => {
  try {
    const { name, description, isPrivate } = req.body;

    if (!name || !REPO_NAME_PATTERN.test(name)) {
      throw new AppError('Repository name may only contain letters, numbers, hyphens, underscores and periods.', 400);
    }

    const status = await githubService.createRepo(req.user.userId, { name, description, isPrivate });
    return sendSuccess(res, 201, status);
  } catch (error) {
    next(error);
  }
};

const connectRepo = async (req, res, next) => {
  try {
    const { owner, name } = req.body;

    if (!owner || !name) {
      throw new AppError('A repository owner and name are required.', 400);
    }

    const status = await githubService.connectExistingRepo(req.user.userId, { owner, name });
    return sendSuccess(res, 200, status);
  } catch (error) {
    next(error);
  }
};

const disconnect = async (req, res, next) => {
  try {
    await githubService.disconnect(req.user.userId);
    return sendSuccess(res, 200, { message: 'GitHub disconnected.' });
  } catch (error) {
    next(error);
  }
};

const getActivityDashboard = async (req, res, next) => {
  try {
    const dashboard = await dashboardService.getActivityDashboard(req.user.userId);
    return sendSuccess(res, 200, dashboard);
  } catch (error) {
    next(error);
  }
};

const retrySync = async (req, res, next) => {
  try {
    const { activityId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(activityId)) {
      throw new AppError('Invalid activity id.', 400);
    }

    const retried = await dashboardService.retrySync(req.user.userId, activityId);
    if (!retried) {
      throw new AppError('Nothing to retry for that activity.', 400);
    }

    return sendSuccess(res, 200, { message: 'Retry queued.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStatus,
  listRepos,
  createRepo,
  connectRepo,
  disconnect,
  getActivityDashboard,
  retrySync,
};
