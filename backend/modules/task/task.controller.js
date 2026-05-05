const taskService = require('./task.service');

const sendSuccess = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const createTask = async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.user.userId, req.body);
    sendSuccess(res, 201, task);
  } catch (error) {
    next(error);
  }
};

const getTasks = async (req, res, next) => {
  try {
    const tasks = await taskService.getTasks(req.user.userId, req.query);
    sendSuccess(res, 200, tasks);
  } catch (error) {
    next(error);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(req.user.userId, req.params.id);
    sendSuccess(res, 200, task);
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.user.userId, req.params.id, req.body);
    sendSuccess(res, 200, task);
  } catch (error) {
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const task = await taskService.deleteTask(req.user.userId, req.params.id);
    sendSuccess(res, 200, task);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
};
