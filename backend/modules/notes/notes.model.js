const mongoose = require('mongoose');

const { Schema } = mongoose;

// PROJECT is reserved for a future Projects feature — the whole point of
// entityType/entityId (instead of a hardcoded taskId) is that this module
// can serve future features with zero migration. TASK and COMPANY (Placement
// Tracker) are reachable today; PROJECT is not yet (see notes.service.js's
// ownership check on create).
const NOTE_ENTITY_TYPE = Object.freeze({
  TASK: 'TASK',
  PROJECT: 'PROJECT',
  COMPANY: 'COMPANY',
});

const checklistItemSchema = new Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: [1, 'Checklist item text is required.'],
      maxlength: [300, 'Checklist item text must be at most 300 characters.'],
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: false }
);

const linkSchema = new Schema(
  {
    label: {
      type: String,
      trim: true,
      maxlength: [120, 'Link label must be at most 120 characters.'],
      default: '',
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, 'Link URL must be at most 2000 characters.'],
    },
  },
  { timestamps: false }
);

// `filename` is a display-only label — it must NEVER be used to build a
// filesystem path (see upload.middleware.js). `storedName` is the randomized
// on-disk name that actually locates the file.
const attachmentSchema = new Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
      maxlength: [255, 'Filename must be at most 255 characters.'],
    },
    storedName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: [0, 'Size cannot be negative.'],
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

const noteSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: Object.values(NOTE_ENTITY_TYPE),
      required: true,
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [200, 'Title must be at most 200 characters.'],
      default: '',
    },
    // Plain Markdown — headings, bold/italic, lists, quotes, fenced code
    // blocks, inline links. Capped generously but boundedly; the cap also
    // keeps a future AI-context prompt (reading these notes) from blowing up.
    body: {
      type: String,
      trim: true,
      maxlength: [20000, 'Note body must be at most 20,000 characters.'],
      default: '',
    },
    checklistItems: {
      type: [checklistItemSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 30;
        },
        message: 'A note can have at most 30 checklist items.',
      },
    },
    links: {
      type: [linkSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 20;
        },
        message: 'A note can have at most 20 links.',
      },
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator(value) {
          return value.length <= 10;
        },
        message: 'A note can have at most 10 attachments.',
      },
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

noteSchema.index({ userId: 1, entityType: 1, entityId: 1, updatedAt: -1 });
noteSchema.index({ userId: 1, entityType: 1, entityId: 1, isPinned: -1 });

module.exports = mongoose.models.Note || mongoose.model('Note', noteSchema);
module.exports.NOTE_ENTITY_TYPE = NOTE_ENTITY_TYPE;
