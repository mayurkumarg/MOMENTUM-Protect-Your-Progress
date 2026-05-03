const mongoose = require('mongoose');

const { Schema } = mongoose;

const ACTIVITY_SOURCE = Object.freeze({
  MANUAL: 'MANUAL',
  DSA: 'DSA',
  GITHUB: 'GITHUB',
});

const ACTIVITY_TYPE = Object.freeze({
  CODING: 'CODING',
  STUDY: 'STUDY',
  ASSIGNMENT: 'ASSIGNMENT',
  PROJECT: 'PROJECT',
  REVISION: 'REVISION',
  OTHER: 'OTHER',
});

const activitySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: Object.values(ACTIVITY_SOURCE),
      default: ACTIVITY_SOURCE.MANUAL,
    },
    activityType: {
      type: String,
      enum: Object.values(ACTIVITY_TYPE),
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, 'Activity title must be at least 3 characters long.'],
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: [1, 'Activity duration must be at least 1 minute.'],
      max: [1440, 'Activity duration cannot exceed 1440 minutes.'],
    },
    activityDate: {
      type: Date,
      required: true,
      default: Date.now,
      validate: {
        validator(value) {
          return value instanceof Date && value.getTime() <= Date.now();
        },
        message: 'Activity date cannot be in the future.',
      },
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.index({ userId: 1, activityDate: -1 });
activitySchema.index({ userId: 1, source: 1 });
activitySchema.index({ userId: 1, activityType: 1 });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
module.exports.ACTIVITY_SOURCE = ACTIVITY_SOURCE;
module.exports.ACTIVITY_TYPE = ACTIVITY_TYPE;
