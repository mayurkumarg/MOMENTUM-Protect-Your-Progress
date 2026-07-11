const path = require('path');
const notesService = require('./notes.service');
const { UPLOAD_ROOT } = require('./upload.middleware');
const AppError = require('../../utils/AppError');

const createNote = async (req, res, next) => {
  try {
    const note = await notesService.createNote(req.user.userId, req.body);
    res.status(201).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

const getNotes = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.query;
    const notes = await notesService.getNotes(req.user.userId, { entityType, entityId });
    res.status(200).json({ success: true, data: notes });
  } catch (error) {
    next(error);
  }
};

const getNoteById = async (req, res, next) => {
  try {
    const note = await notesService.getNoteById(req.user.userId, req.params.id);
    res.status(200).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

const updateNote = async (req, res, next) => {
  try {
    const note = await notesService.updateNote(req.user.userId, req.params.id, req.body);
    res.status(200).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

const deleteNote = async (req, res, next) => {
  try {
    await notesService.deleteNote(req.user.userId, req.params.id);
    res.status(200).json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};

const uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file was uploaded.', 400);
    }
    const note = await notesService.addAttachment(req.user.userId, req.params.id, req.file);
    res.status(201).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

// Strips characters that could break out of the Content-Disposition header
// value (CRLF injection, quotes) — the original filename is user-controlled.
const sanitizeForHeader = (value) => value.replace(/[^\x20-\x7E]/g, '').replace(/["\\]/g, '');

const downloadAttachment = async (req, res, next) => {
  try {
    const attachment = await notesService.getOwnedAttachment(req.user.userId, req.params.id, req.params.attachmentId);
    const filePath = path.join(UPLOAD_ROOT, attachment.storedName);

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeForHeader(attachment.filename)}"`);
    res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        next(new AppError('Attachment file could not be found on the server.', 404));
      }
    });
  } catch (error) {
    next(error);
  }
};

const deleteAttachment = async (req, res, next) => {
  try {
    const note = await notesService.deleteAttachment(req.user.userId, req.params.id, req.params.attachmentId);
    res.status(200).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
  uploadAttachment,
  downloadAttachment,
  deleteAttachment,
};
