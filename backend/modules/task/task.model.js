const mongoose = require('mongoose');

const { Schema } = mongoose;

const TASK_STATUS = Object.freeze({
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
});

const TASK_PRIORITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
});

// Reminder offsets, in minutes before the deadline. 0 means "at due time".
// A custom reminder stores its own absolute `remindAt` directly instead.
const reminderSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    offsetMinutes: {
      type: Number,
      default: 0,
    },
    isCustom: {
      type: Boolean,
      default: false,
    },
    // Computed (deadline - offsetMinutes) on save, or set directly for a
    // custom reminder — the single source of truth the reminder check reads.
    remindAt: {
      type: Date,
      default: null,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

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
    priority: {
      type: String,
      enum: Object.values(TASK_PRIORITY),
      default: TASK_PRIORITY.MEDIUM,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    reminder: {
      type: reminderSchema,
      default: () => ({}),
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
taskSchema.index({ userId: 1, 'reminder.remindAt': 1 });

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

// Purely computes remindAt from the current deadline/offset — idempotent, so
// it's safe to run on every save regardless of what changed. Whether a
// reschedule should also clear `notifiedAt` is decided in task.service.js's
// updateTask, which has access to the real before/after values; Mongoose
// marks an entire single-nested subdocument "modified" on any whole-object
// assignment (which is how updates arrive here), so isModified() on
// individual reminder fields can't tell an actual reschedule apart from the
// reminder watcher merely marking a reminder as fired.
taskSchema.pre('save', function setReminderRemindAt() {
  if (!this.reminder || !this.reminder.enabled) {
    if (this.reminder) this.reminder.remindAt = null;
    return;
  }

  if (!this.reminder.isCustom) {
    this.reminder.remindAt = new Date(this.deadline.getTime() - this.reminder.offsetMinutes * 60000);
  }

  // Reset once the task is done, since there's nothing left to remind about.
  if (this.status === TASK_STATUS.COMPLETED) {
    this.reminder.remindAt = null;
  }
});

taskSchema.methods.markCompleted = function markCompleted() {
  this.status = TASK_STATUS.COMPLETED;
  return this.save();
};

module.exports = mongoose.models.Task || mongoose.model('Task', taskSchema);
module.exports.TASK_STATUS = TASK_STATUS;
module.exports.TASK_PRIORITY = TASK_PRIORITY;
