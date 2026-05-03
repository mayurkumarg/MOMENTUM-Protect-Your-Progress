const taskService = require('./task.service');

const MOCK_USER_ID = '665f1f1f1f1f1f1f1f1f1f1f';

const sendSuccess = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const createTask = async (req, res, next) => {
  try {
    const task = await taskService.createTask(MOCK_USER_ID, req.body);
    sendSuccess(res, 201, task);
  } catch (error) {
    next(error);
  }
};

const getTasks = async (req, res, next) => {
  try {
    const tasks = await taskService.getTasks(MOCK_USER_ID, req.query);
    sendSuccess(res, 200, tasks);
  } catch (error) {
    next(error);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await taskService.getTaskById(MOCK_USER_ID, req.params.id);
    sendSuccess(res, 200, task);
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const task = await taskService.updateTask(MOCK_USER_ID, req.params.id, req.body);
    sendSuccess(res, 200, task);
  } catch (error) {
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const task = await taskService.deleteTask(MOCK_USER_ID, req.params.id);
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
