const mongoose = require('mongoose');
const Task = require('./task.model');
const AppError = require('../../utils/AppError');

const { TASK_STATUS } = Task;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const assertValidObjectId = (id, label = 'id') => {
  if (!isValidObjectId(id)) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
};

const assertAllowedUpdates = (updates) => {
  const allowedFields = [
    'title',
    'deadline',
    'estimatedHours',
    'status',
    'priority',
    'category',
    'companyId',
    'tags',
    'subtasks',
    'addSubtasks',
    'subtaskUpdates',
    'reminder',
  ];
  const invalidFields = Object.keys(updates).filter((field) => !allowedFields.includes(field));

  if (invalidFields.length > 0) {
    throw new AppError(`Invalid update fields: ${invalidFields.join(', ')}.`, 400);
  }
};

const serializeTask = (task) => {
  const taskObject = task.toJSON ? task.toJSON() : task;

  return {
    id: taskObject._id,
    title: taskObject.title,
    status: taskObject.status,
    priority: taskObject.priority,
    category: taskObject.category,
    companyId: taskObject.companyId,
    tags: taskObject.tags,
    progress: taskObject.progress,
    estimatedHours: taskObject.estimatedHours,
    deadline: taskObject.deadline,
    completedAt: taskObject.completedAt,
    reminder: taskObject.reminder,
    subtasks: taskObject.subtasks,
    createdAt: taskObject.createdAt,
    updatedAt: taskObject.updatedAt,
  };
};

const normalizePagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const buildTaskFilters = (userId, query) => {
  const filters = { userId };

  if (query.status) {
    if (!Object.values(TASK_STATUS).includes(query.status)) {
      throw new AppError('Invalid status filter.', 400);
    }

    filters.status = query.status;
  }

  if (query.category) {
    filters.category = query.category;
  }

  if (query.companyId) {
    assertValidObjectId(query.companyId, 'companyId');
    filters.companyId = query.companyId;
  }

  if (query.tags) {
    const tags = Array.isArray(query.tags)
      ? query.tags
      : String(query.tags)
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);

    if (tags.length > 0) {
      filters.tags = { $all: tags };
    }
  }

  if (query.deadlineFrom || query.deadlineTo) {
    filters.deadline = {};

    if (query.deadlineFrom) {
      const from = new Date(query.deadlineFrom);

      if (Number.isNaN(from.getTime())) {
        throw new AppError('Invalid deadlineFrom filter.', 400);
      }

      filters.deadline.$gte = from;
    }

    if (query.deadlineTo) {
      const to = new Date(query.deadlineTo);

      if (Number.isNaN(to.getTime())) {
        throw new AppError('Invalid deadlineTo filter.', 400);
      }

      filters.deadline.$lte = to;
    }
  }

  return filters;
};

const applySubtaskUpdates = (task, subtaskUpdates) => {
  if (!Array.isArray(subtaskUpdates)) {
    throw new AppError('subtaskUpdates must be an array.', 400);
  }

  subtaskUpdates.forEach((update) => {
    let subtask;

    if (update.subtaskId) {
      subtask = task.subtasks.id(update.subtaskId);
    } else if (Number.isInteger(update.index)) {
      subtask = task.subtasks[update.index];
    }

    if (!subtask) {
      throw new AppError('Subtask not found.', 404);
    }

    if (typeof update.isCompleted !== 'boolean') {
      throw new AppError('Subtask isCompleted must be a boolean.', 400);
    }

    subtask.isCompleted = update.isCompleted;
  });
};

const createTask = async (userId, data) => {
  assertValidObjectId(userId, 'userId');

  const task = await Task.create({
    userId,
    title: data.title,
    estimatedHours: data.estimatedHours,
    deadline: data.deadline,
    status: data.status,
    priority: data.priority,
    category: data.category,
    companyId: data.companyId,
    tags: data.tags,
    subtasks: data.subtasks,
    reminder: data.reminder,
  });

  return serializeTask(task);
};

const getTasks = async (userId, query = {}) => {
  assertValidObjectId(userId, 'userId');

  const filters = buildTaskFilters(userId, query);
  const { page, limit, skip } = normalizePagination(query);

  const [tasks, total] = await Promise.all([
    Task.find(filters).sort({ deadline: 1 }).skip(skip).limit(limit),
    Task.countDocuments(filters),
  ]);

  return {
    tasks: tasks.map(serializeTask),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getTaskById = async (userId, taskId) => {
  assertValidObjectId(userId, 'userId');
  assertValidObjectId(taskId, 'taskId');

  const task = await Task.findOne({ _id: taskId, userId });

  if (!task) {
    throw new AppError('Task not found or unauthorized.', 404);
  }

  return serializeTask(task);
};

// True if the reminder's actual firing schedule moved (offset/custom-time/
// enabled toggled, or the deadline shifted) — as opposed to only `notifiedAt`
// changing, which is how the reminder watcher marks a reminder as fired.
// Needed because Mongoose can't tell these apart via isModified() once a
// whole reminder object has been assigned (see task.model.js).
const reminderScheduleChanged = (previous, next, deadlineChanged) => {
  if (deadlineChanged) return true;
  if (!previous || !next) return Boolean(next);
  if (previous.enabled !== next.enabled) return true;
  if (previous.isCustom !== next.isCustom) return true;
  if (!next.isCustom) return previous.offsetMinutes !== next.offsetMinutes;

  const previousTime = previous.remindAt ? new Date(previous.remindAt).getTime() : null;
  const nextTime = next.remindAt ? new Date(next.remindAt).getTime() : null;
  return previousTime !== nextTime;
};

const updateTask = async (userId, taskId, updates) => {
  assertValidObjectId(userId, 'userId');
  assertValidObjectId(taskId, 'taskId');
  assertAllowedUpdates(updates);

  const task = await Task.findOne({ _id: taskId, userId });

  if (!task) {
    throw new AppError('Task not found or unauthorized.', 404);
  }

  const previousReminder = task.reminder ? task.reminder.toObject() : null;
  const previousDeadline = task.deadline;

  const directUpdates = { ...updates };
  delete directUpdates.addSubtasks;
  delete directUpdates.subtaskUpdates;

  Object.assign(task, directUpdates);

  // Assigning a whole reminder object (as every caller does — the edit form
  // resubmits it on every save, the reminder watcher marks one as fired the
  // same way) replaces the subdocument outright: any field the new object
  // omits — notifiedAt included — resets to its schema default rather than
  // carrying over. So notifiedAt has to be explicitly reconciled here:
  //  - schedule actually moved -> clear it, the reminder should fire again
  //  - schedule unchanged, caller didn't mention notifiedAt (edit form
  //    resubmitting an unrelated field) -> restore the previous value
  //  - schedule unchanged, caller explicitly set notifiedAt (the reminder
  //    watcher marking one as fired) -> respect it, already applied above
  if (updates.reminder !== undefined && task.reminder) {
    const deadlineChanged = Boolean(previousDeadline) && Boolean(task.deadline) && previousDeadline.getTime() !== task.deadline.getTime();
    const changed = reminderScheduleChanged(previousReminder, task.reminder.toObject(), deadlineChanged);
    const callerSetNotifiedAt = Object.prototype.hasOwnProperty.call(updates.reminder, 'notifiedAt');
    // emailSentAt gets the exact same treatment as notifiedAt, independently
    // — it's the email channel's own "already fired" flag (see task.model.js).
    const callerSetEmailSentAt = Object.prototype.hasOwnProperty.call(updates.reminder, 'emailSentAt');

    if (changed) {
      task.reminder.notifiedAt = null;
      task.reminder.emailSentAt = null;
    } else {
      if (!callerSetNotifiedAt) task.reminder.notifiedAt = previousReminder?.notifiedAt || null;
      if (!callerSetEmailSentAt) task.reminder.emailSentAt = previousReminder?.emailSentAt || null;
    }
  }

  if (updates.addSubtasks) {
    if (!Array.isArray(updates.addSubtasks)) {
      throw new AppError('addSubtasks must be an array.', 400);
    }

    task.subtasks.push(...updates.addSubtasks);
  }

  if (updates.subtaskUpdates) {
    applySubtaskUpdates(task, updates.subtaskUpdates);
  }

  if (
    task.subtasks.length > 0 &&
    task.subtasks.every((subtask) => subtask.isCompleted) &&
    updates.status !== TASK_STATUS.PENDING
  ) {
    task.status = TASK_STATUS.COMPLETED;
  }

  if (updates.status === TASK_STATUS.COMPLETED && !task.completedAt) {
    task.completedAt = new Date();
  }

  if (updates.status === TASK_STATUS.PENDING) {
    task.completedAt = null;
  }

  await task.save();

  return serializeTask(task);
};

const deleteTask = async (userId, taskId) => {
  assertValidObjectId(userId, 'userId');
  assertValidObjectId(taskId, 'taskId');

  const task = await Task.findOneAndDelete({ _id: taskId, userId });

  if (!task) {
    throw new AppError('Task not found or unauthorized.', 404);
  }

  // Best-effort — a notes-cleanup failure should never block the task-delete
  // response the caller is waiting on. Lazily required to avoid a
  // module-load-order dependency between task.service.js and notes.service.js.
  try {
    const notesService = require('../notes/notes.service');
    await notesService.deleteAllForEntity(userId, 'TASK', taskId);
  } catch (cleanupError) {
    console.error(`[task] failed to clean up notes for deleted task ${taskId}:`, cleanupError.message);
  }

  return serializeTask(task);
};

module.exports = {
  AppError,
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
};
