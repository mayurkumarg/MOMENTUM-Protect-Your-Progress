const mongoose = require('mongoose');

const { Schema } = mongoose;

const TASK_STATUS = Object.freeze({
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
});

const subtaskSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: [1, 'Subtask title is required.'],
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: false,
  }
);

const taskSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long.'],
    },
    estimatedHours: {
      type: Number,
      required: true,
      min: [0, 'Estimated hours cannot be negative.'],
      max: [100, 'Estimated hours must be between 0 and 100.'],
    },
    deadline: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return value instanceof Date && value.getTime() > Date.now();
        },
        message: 'Deadline must be in the future.',
      },
    },
    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.PENDING,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    category: {
      type: String,
      trim: true,
      default: null,
    },
    tags: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },
    subtasks: {
      type: [subtaskSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 10;
        },
        message: 'A task can have at most 10 subtasks.',
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

taskSchema.index({ userId: 1, deadline: 1 });
taskSchema.index({ userId: 1, category: 1 });
taskSchema.index({ userId: 1, tags: 1 });

taskSchema.virtual('progress').get(function getProgress() {
  if (!this.subtasks || this.subtasks.length === 0) {
    return 0;
  }

  const completedCount = this.subtasks.filter((subtask) => subtask.isCompleted).length;

  return completedCount / this.subtasks.length;
});

taskSchema.pre('save', function setCompletedAt() {
  if (this.subtasks.length > 0 && this.subtasks.every((subtask) => subtask.isCompleted)) {
    this.status = TASK_STATUS.COMPLETED;
  }

  if (this.isModified('status') && this.status === TASK_STATUS.COMPLETED && !this.completedAt) {
    this.completedAt = new Date();
  }

  if (this.isModified('status') && this.status === TASK_STATUS.PENDING) {
    this.completedAt = null;
  }
});

taskSchema.methods.markCompleted = function markCompleted() {
  this.status = TASK_STATUS.COMPLETED;
  return this.save();
};

module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
module.exports.TASK_STATUS = TASK_STATUS;
