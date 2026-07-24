const multer = require('multer');

// Uploads are held in memory only, then streamed into GridFS by the notes
// service (see attachment.storage.js) — nothing is ever written to local disk.
// The deployment target's filesystem is ephemeral, so disk storage would lose
// every file on each deploy/restart. The 15MB cap below keeps a single buffered
// upload small enough to hold in memory safely.

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const MAX_ATTACHMENTS_PER_NOTE = 10;

// mimetype -> extension. Deliberately excludes image/svg+xml: an SVG can
// carry embedded <script>, which would be a stored-XSS risk if ever served
// or previewed inline, even as a "download".
const ALLOWED_MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
  'text/plain': '.txt',
};

// Buffer the upload in memory; the notes service streams it into GridFS under a
// server-generated ObjectId, so the user's original filename is never used to
// build any storage path (GridFS or otherwise) — path traversal stays
// impossible, the same guarantee the old randomized disk name provided.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME_EXTENSIONS[file.mimetype]) {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

module.exports = {
  upload,
  MAX_FILE_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_NOTE,
  ALLOWED_MIME_EXTENSIONS,
};
