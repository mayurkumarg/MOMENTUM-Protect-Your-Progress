const mongoose = require('mongoose');

const { Schema } = mongoose;

// A single lifecycle status, not "process stage" + "final result" as two
// fields — a company can only ever be in one state at a time, and splitting
// that into two fields invites them disagreeing (e.g. status="HR Round" but
// result="Selected"). Interview rounds are deliberately NOT individually
// enumerated (real companies have 1-5+ rounds) — INTERVIEWING covers all of
// them collectively, with per-round detail captured in importantDates below.
const COMPANY_STATUS = Object.freeze({
  WISHLIST: 'WISHLIST',
  PREPARING: 'PREPARING',
  APPLIED: 'APPLIED',
  OA_SCHEDULED: 'OA_SCHEDULED',
  OA_COMPLETED: 'OA_COMPLETED',
  INTERVIEWING: 'INTERVIEWING',
  SELECTED: 'SELECTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
});

// Same shape as Task's reminder subschema (task.model.js) — offset/custom
// pattern, remindAt computed on save, notifiedAt (in-app) and emailSentAt
// (email channel) tracked independently so the two never race each other.
const eventReminderSchema = new Schema(
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
    remindAt: {
      type: Date,
      default: null,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const importantDateSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      minlength: [1, 'Label is required.'],
      maxlength: [100, 'Label must be at most 100 characters.'],
    },
    date: {
      type: Date,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes must be at most 500 characters.'],
      default: '',
    },
    reminder: {
      type: eventReminderSchema,
      default: () => ({}),
    },
  },
  { timestamps: false }
);

const companySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [1, 'Company name is required.'],
      maxlength: [150, 'Company name must be at most 150 characters.'],
    },
    // Pasted URL, not an upload — the frontend falls back to an initial-letter
    // avatar when this is empty, so a full image-upload pipeline (already
    // built for Notes attachments) would be disproportionate for this.
    logoUrl: {
      type: String,
      trim: true,
      maxlength: [2000, 'Logo URL must be at most 2000 characters.'],
      default: '',
    },
    role: {
      type: String,
      trim: true,
      maxlength: [150, 'Role must be at most 150 characters.'],
      default: '',
    },
    location: {
      type: String,
      trim: true,
      maxlength: [150, 'Location must be at most 150 characters.'],
      default: '',
    },
    // Free text ("18 LPA", "$120k") — a structured currency field is overkill
    // for a value that's often a range or "not disclosed" anyway.
    packageInfo: {
      type: String,
      trim: true,
      maxlength: [100, 'Package must be at most 100 characters.'],
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(COMPANY_STATUS),
      default: COMPANY_STATUS.WISHLIST,
    },
    resumeVersion: {
      type: String,
      trim: true,
      maxlength: [100, 'Resume version must be at most 100 characters.'],
      default: '',
    },
    // No future/past constraint (unlike Task.deadline) — this is a record of
    // when an application was submitted, not a commitment to keep.
    applicationDate: {
      type: Date,
      default: null,
    },
    importantDates: {
      type: [importantDateSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 20;
        },
        message: 'A company can have at most 20 important dates.',
      },
    },
  },
  {
    timestamps: true,
  }
);

companySchema.index({ userId: 1, status: 1 });
companySchema.index({ userId: 1, 'importantDates.reminder.remindAt': 1 });

// Important dates are date-only (no time-of-day input in the UI) — an
// offset-based reminder anchors to 9:00 AM local on that date. A custom
// reminder stores its own exact remindAt directly and is left untouched here.
// Mirrors task.model.js's setReminderRemindAt: unconditional and idempotent,
// safe to run on every save regardless of what changed.
const DEFAULT_REMINDER_HOUR = 9;

companySchema.pre('save', function setImportantDateReminders() {
  for (const entry of this.importantDates) {
    if (!entry.reminder || !entry.reminder.enabled) {
      if (entry.reminder) entry.reminder.remindAt = null;
      continue;
    }

    if (!entry.reminder.isCustom) {
      const base = new Date(entry.date);
      base.setHours(DEFAULT_REMINDER_HOUR, 0, 0, 0);
      entry.reminder.remindAt = new Date(base.getTime() - entry.reminder.offsetMinutes * 60000);
    }
  }
});

module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);
module.exports.COMPANY_STATUS = COMPANY_STATUS;
