const mongoose = require('mongoose');
const Note = require('./notes.model');
const Task = require('../task/task.model');
const Company = require('../companies/company.model');
const AppError = require('../../utils/AppError');
const { MAX_ATTACHMENTS_PER_NOTE } = require('./upload.middleware');
const attachmentStorage = require('./attachment.storage');

const { NOTE_ENTITY_TYPE } = Note;

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const assertValidObjectId = (id, label = 'id') => {
  if (!isValidObjectId(id)) {
    throw new AppError(`Invalid ${label}.`, 400);
  }
};

const assertAllowedUpdates = (updates) => {
  const allowedFields = ['title', 'body', 'checklistItems', 'links', 'isPinned'];
  const invalidFields = Object.keys(updates).filter((field) => !allowedFields.includes(field));

  if (invalidFields.length > 0) {
    throw new AppError(`Invalid update fields: ${invalidFields.join(', ')}.`, 400);
  }
};

// Never exposes fileId — that's the internal GridFS pointer; the client only
// ever sees the attachment's Mongo _id (used to build the authenticated
// download URL, which resolves fileId server-side).
const serializeNote = (note) => {
  const noteObject = note.toJSON ? note.toJSON() : note;

  return {
    id: noteObject._id,
    entityType: noteObject.entityType,
    entityId: noteObject.entityId,
    title: noteObject.title,
    body: noteObject.body,
    checklistItems: noteObject.checklistItems,
    links: noteObject.links,
    attachments: (noteObject.attachments || []).map((attachment) => ({
      id: attachment._id,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
      uploadedAt: attachment.uploadedAt,
    })),
    isPinned: noteObject.isPinned,
    createdAt: noteObject.createdAt,
    updatedAt: noteObject.updatedAt,
  };
};

// TASK and COMPANY are reachable today — each verifies the referenced entity
// exists and belongs to the caller before a note can be attached to it.
// PROJECT sits in the schema enum unused until that feature exists (see
// notes.model.js).
const assertEntityOwnership = async (userId, entityType, entityId) => {
  if (entityType === NOTE_ENTITY_TYPE.TASK) {
    const task = await Task.findOne({ _id: entityId, userId });
    if (!task) {
      throw new AppError('Task not found or unauthorized.', 404);
    }
    return;
  }

  if (entityType === NOTE_ENTITY_TYPE.COMPANY) {
    const company = await Company.findOne({ _id: entityId, userId });
    if (!company) {
      throw new AppError('Company not found or unauthorized.', 404);
    }
    return;
  }

  throw new AppError(`Notes for entityType "${entityType}" are not available yet.`, 400);
};

const createNote = async (userId, data) => {
  assertValidObjectId(userId, 'userId');

  const { entityType, entityId } = data;

  if (!Object.values(NOTE_ENTITY_TYPE).includes(entityType)) {
    throw new AppError('Invalid entityType.', 400);
  }
  assertValidObjectId(entityId, 'entityId');
  await assertEntityOwnership(userId, entityType, entityId);

  const title = (data.title || '').trim();
  const body = (data.body || '').trim();

  if (!title && !body) {
    throw new AppError('A note needs a title or some content.', 400);
  }

  const note = await Note.create({
    userId,
    entityType,
    entityId,
    title,
    body,
    checklistItems: data.checklistItems || [],
    links: data.links || [],
  });

  return serializeNote(note);
};

const getNotes = async (userId, { entityType, entityId }) => {
  assertValidObjectId(userId, 'userId');

  if (!Object.values(NOTE_ENTITY_TYPE).includes(entityType)) {
    throw new AppError('Invalid entityType.', 400);
  }
  assertValidObjectId(entityId, 'entityId');

  const notes = await Note.find({ userId, entityType, entityId }).sort({ updatedAt: -1 });

  return notes.map(serializeNote);
};

const findOwnedNote = async (userId, noteId) => {
  assertValidObjectId(userId, 'userId');
  assertValidObjectId(noteId, 'noteId');

  const note = await Note.findOne({ _id: noteId, userId });
  if (!note) {
    throw new AppError('Note not found or unauthorized.', 404);
  }
  return note;
};

const getNoteById = async (userId, noteId) => {
  const note = await findOwnedNote(userId, noteId);
  return serializeNote(note);
};

const updateNote = async (userId, noteId, updates) => {
  assertAllowedUpdates(updates);
  const note = await findOwnedNote(userId, noteId);

  const nextTitle = updates.title !== undefined ? updates.title.trim() : note.title;
  const nextBody = updates.body !== undefined ? updates.body.trim() : note.body;

  if (!nextTitle && !nextBody) {
    throw new AppError('A note needs a title or some content.', 400);
  }

  Object.assign(note, { ...updates, title: nextTitle, body: nextBody });
  await note.save();

  return serializeNote(note);
};

// Best-effort GridFS cleanup — a stray file left behind by a failed delete is
// harmless clutter (attachment.storage swallows FileNotFound and logs the rest).
// Runs after the note is already gone, so a cleanup failure never blocks a delete.
const removeAttachmentFiles = (attachments) => {
  for (const attachment of attachments) {
    if (attachment.fileId) {
      attachmentStorage.deleteFile(attachment.fileId).catch(() => {});
    }
  }
};

const deleteNote = async (userId, noteId) => {
  const note = await findOwnedNote(userId, noteId);
  removeAttachmentFiles(note.attachments);
  await note.deleteOne();
  return serializeNote(note);
};

// Cascade cleanup used by task.service.js when a task is deleted. Deliberately
// swallow-free here — the caller wraps this in a best-effort try/catch so a
// cleanup failure never blocks the task-delete response (see task.service.js).
const deleteAllForEntity = async (userId, entityType, entityId) => {
  const notes = await Note.find({ userId, entityType, entityId }).select('attachments');
  for (const note of notes) {
    removeAttachmentFiles(note.attachments);
  }
  await Note.deleteMany({ userId, entityType, entityId });
};

const addAttachment = async (userId, noteId, file) => {
  const note = await findOwnedNote(userId, noteId);

  // The file is only buffered in memory at this point (multer memoryStorage),
  // so an over-limit upload is simply not persisted — nothing to clean up.
  if (note.attachments.length >= MAX_ATTACHMENTS_PER_NOTE) {
    throw new AppError(`A note can have at most ${MAX_ATTACHMENTS_PER_NOTE} attachments.`, 400);
  }

  const fileId = await attachmentStorage.uploadBuffer(file.buffer, {
    filename: file.originalname,
    mimeType: file.mimetype,
  });

  note.attachments.push({
    filename: file.originalname,
    fileId,
    mimeType: file.mimetype,
    size: file.size,
  });

  try {
    await note.save();
  } catch (error) {
    // The GridFS bytes are already written; if attaching them to the note
    // fails (validation, concurrent delete), remove the orphan rather than
    // leaking storage.
    attachmentStorage.deleteFile(fileId).catch(() => {});
    throw error;
  }

  return serializeNote(note);
};

// Returns the raw attachment subdoc (with fileId) for the controller's
// streaming download — internal use only, never passed through serializeNote.
const getOwnedAttachment = async (userId, noteId, attachmentId) => {
  const note = await findOwnedNote(userId, noteId);
  const attachment = note.attachments.id(attachmentId);

  if (!attachment) {
    throw new AppError('Attachment not found.', 404);
  }

  return attachment;
};

const deleteAttachment = async (userId, noteId, attachmentId) => {
  const note = await findOwnedNote(userId, noteId);
  const attachment = note.attachments.id(attachmentId);

  if (!attachment) {
    throw new AppError('Attachment not found.', 404);
  }

  removeAttachmentFiles([attachment]);
  note.attachments.pull(attachmentId);
  await note.save();

  return serializeNote(note);
};

module.exports = {
  AppError,
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
  deleteAllForEntity,
  addAttachment,
  getOwnedAttachment,
  deleteAttachment,
};
