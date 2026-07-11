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
    // Precise duration when we have it (e.g. read from the platform's own timer).
    // Absent on older records and on wall-clock estimates — durationMinutes above
    // stays the field every existing consumer already reads.
    durationSeconds: {
      type: Number,
      min: [1, 'Duration in seconds must be at least 1.'],
    },
    // Whether durationMinutes/durationSeconds came from an authoritative source
    // (the platform's own timer) or our own estimate. Defaults true since older
    // records' hardcoded duration was never a real measurement either.
    isEstimatedDuration: {
      type: Boolean,
      default: true,
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
    // Populated only for DSA activities that go through the GitHub journal
    // sync (backend/modules/github/sync). Absent on every other activity.
    githubSync: {
      status: {
        type: String,
        enum: ['pending', 'synced', 'failed', 'skipped'],
      },
      attempts: {
        type: Number,
        default: 0,
      },
      lastAttemptAt: Date,
      commitSha: String,
      filePath: String,
      error: String,
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.index({ userId: 1, activityDate: -1 });
activitySchema.index({ userId: 1, source: 1 });
activitySchema.index({ userId: 1, activityType: 1 });
activitySchema.index({ userId: 1, source: 1, title: 1, activityDate: -1 });

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
module.exports.ACTIVITY_SOURCE = ACTIVITY_SOURCE;
module.exports.ACTIVITY_TYPE = ACTIVITY_TYPE;
