const mongoose = require('mongoose');
const Activity = require('./activity.model');
const AppError = require('../../utils/AppError');

const { ACTIVITY_SOURCE, ACTIVITY_TYPE } = Activity;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const assertValidObjectId = (id, label = 'id') => {
  if (!isValidObjectId(id)) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
};

const assertAllowedUpdates = (updates) => {
  const allowedFields = [
    'source',
    'activityType',
    'title',
    'durationMinutes',
    'activityDate',
    'taskId',
    'category',
    'metadata',
  ];
  const invalidFields = Object.keys(updates).filter((field) => !allowedFields.includes(field));

  if (invalidFields.length > 0) {
    throw new AppError(`Invalid update fields: ${invalidFields.join(', ')}.`, 400);
  }
};

const normalizePagination = (query) => {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

const serializeActivity = (activity) => {
  const activityObject = activity.toJSON ? activity.toJSON() : activity;

  return {
    id: activityObject._id,
    source: activityObject.source,
    activityType: activityObject.activityType,
    title: activityObject.title,
    durationMinutes: activityObject.durationMinutes,
    activityDate: activityObject.activityDate,
    taskId: activityObject.taskId,
    category: activityObject.category,
    metadata: activityObject.metadata,
    createdAt: activityObject.createdAt,
    updatedAt: activityObject.updatedAt,
  };
};

const parseDateFilter = (value, label) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${label} filter.`, 400);
  }

  return date;
};

const buildActivityFilters = (userId, query) => {
  const filters = { userId };

  if (query.source) {
    if (!Object.values(ACTIVITY_SOURCE).includes(query.source)) {
      throw new AppError('Invalid source filter.', 400);
    }

    filters.source = query.source;
  }

  if (query.activityType) {
    if (!Object.values(ACTIVITY_TYPE).includes(query.activityType)) {
      throw new AppError('Invalid activityType filter.', 400);
    }

    filters.activityType = query.activityType;
  }

  if (query.category) {
    filters.category = query.category;
  }

  if (query.taskId) {
    assertValidObjectId(query.taskId, 'taskId');
    filters.taskId = query.taskId;
  }

  if (query.dateFrom || query.dateTo) {
    filters.activityDate = {};

    if (query.dateFrom) {
      filters.activityDate.$gte = parseDateFilter(query.dateFrom, 'dateFrom');
    }

    if (query.dateTo) {
      filters.activityDate.$lte = parseDateFilter(query.dateTo, 'dateTo');
    }
  }

  return filters;
};

const createActivity = async (userId, data) => {
  assertValidObjectId(userId, 'userId');

  if (data.taskId) {
    assertValidObjectId(data.taskId, 'taskId');
  }

  const activity = await Activity.create({
    userId,
    source: data.source,
    activityType: data.activityType,
    title: data.title,
    durationMinutes: data.durationMinutes,
    activityDate: data.activityDate,
    taskId: data.taskId,
    category: data.category,
    metadata: data.metadata,
  });

  return serializeActivity(activity);
};

const getActivities = async (userId, query = {}) => {
  assertValidObjectId(userId, 'userId');

  const filters = buildActivityFilters(userId, query);
  const { page, limit, skip } = normalizePagination(query);

  const [activities, total] = await Promise.all([
    Activity.find(filters).sort({ activityDate: -1 }).skip(skip).limit(limit),
    Activity.countDocuments(filters),
  ]);

  return {
    activities: activities.map(serializeActivity),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const getActivityById = async (userId, activityId) => {
  assertValidObjectId(userId, 'userId');
  assertValidObjectId(activityId, 'activityId');

  const activity = await Activity.findOne({ _id: activityId, userId });

  if (!activity) {
    throw new AppError('Activity not found or unauthorized.', 404);
  }

  return serializeActivity(activity);
};

const updateActivity = async (userId, activityId, updates) => {
  assertValidObjectId(userId, 'userId');
  assertValidObjectId(activityId, 'activityId');
  assertAllowedUpdates(updates);

  if (updates.taskId) {
    assertValidObjectId(updates.taskId, 'taskId');
  }

  const activity = await Activity.findOne({ _id: activityId, userId });

  if (!activity) {
    throw new AppError('Activity not found or unauthorized.', 404);
  }

  Object.assign(activity, updates);

  await activity.save();

  return serializeActivity(activity);
};

const deleteActivity = async (userId, activityId) => {
  assertValidObjectId(userId, 'userId');
  assertValidObjectId(activityId, 'activityId');

  const activity = await Activity.findOneAndDelete({ _id: activityId, userId });

  if (!activity) {
    throw new AppError('Activity not found or unauthorized.', 404);
  }

  return serializeActivity(activity);
};

module.exports = {
  AppError,
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
};
