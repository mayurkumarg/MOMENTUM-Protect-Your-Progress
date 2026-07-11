const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// Local disk storage — this project has no production deployment yet
// (everything runs on localhost), so cloud object storage would be new
// infra nobody asked for. Files live outside the repo's tracked content
// (see .gitignore: backend/uploads/).
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads', 'notes');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

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

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_ROOT);
  },
  // Randomized name — the original filename is never interpolated into a
  // filesystem path, which eliminates path-traversal risk outright rather
  // than relying on sanitizing user input.
  filename(req, file, cb) {
    const ext = ALLOWED_MIME_EXTENSIONS[file.mimetype] || '';
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

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
  UPLOAD_ROOT,
  MAX_FILE_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_NOTE,
  ALLOWED_MIME_EXTENSIONS,
};
