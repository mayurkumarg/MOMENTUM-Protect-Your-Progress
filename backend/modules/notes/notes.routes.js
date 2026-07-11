const express = require('express');
const multer = require('multer');
const notesController = require('./notes.controller');
const authMiddleware = require('../../middlewares/authMiddleware');
const AppError = require('../../utils/AppError');
const { upload, MAX_FILE_SIZE_BYTES } = require('./upload.middleware');

const router = express.Router();

router.use(authMiddleware);

// Wraps multer's callback-style error handling so a bad upload (too large,
// unsupported type) becomes a normal AppError through the existing error
// middleware, instead of an unhandled/500 response.
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(`File is too large. Maximum size is ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.`, 400));
      }
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError('That file type is not supported.', 400));
      }
      return next(new AppError('Could not process the file upload.', 400));
    }

    return next(error);
  });
};

router.post('/', notesController.createNote);
router.get('/', notesController.getNotes);
router.get('/:id', notesController.getNoteById);
router.patch('/:id', notesController.updateNote);
router.delete('/:id', notesController.deleteNote);

router.post('/:id/attachments', handleUpload, notesController.uploadAttachment);
router.get('/:id/attachments/:attachmentId', notesController.downloadAttachment);
router.delete('/:id/attachments/:attachmentId', notesController.deleteAttachment);

module.exports = router;
