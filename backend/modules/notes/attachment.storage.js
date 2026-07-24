const mongoose = require('mongoose');
const { Readable } = require('stream');

// Note attachments live in GridFS on the SAME MongoDB the rest of the app uses,
// not on local disk — the deployment target (Render) has an ephemeral
// filesystem, so disk-stored uploads vanish on every deploy/restart while their
// metadata survives in the notes collection, leaving broken download links.
// GridFS keeps the bytes in the database (chunked, so it handles files larger
// than the 16MB BSON document limit) and therefore persists exactly as long as
// the note that references them.
const BUCKET_NAME = 'note_attachments';

// The bucket needs the live connection's db handle, which only exists after
// connectDB() has run — so resolve it lazily per call rather than at module load.
const getBucket = () => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not ready for attachment storage.');
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
};

// Streams an in-memory buffer (from multer's memoryStorage) into GridFS and
// resolves with the new file's ObjectId, which is what the attachment subdoc
// stores as `fileId`.
const uploadBuffer = (buffer, { filename, mimeType }) =>
  new Promise((resolve, reject) => {
    const bucket = getBucket();
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: mimeType,
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', () => resolve(uploadStream.id));

    Readable.from(buffer).pipe(uploadStream);
  });

// Returns a readable stream of the stored file for the download controller to
// pipe to the response. The caller handles the 'error' event (missing file → 404).
const openDownloadStream = (fileId) => getBucket().openDownloadStream(toObjectId(fileId));

// Best-effort deletion — a stray GridFS file left behind by a failed delete is
// harmless clutter, so a missing file (FileNotFound) is swallowed rather than
// surfaced, mirroring the old disk-unlink ENOENT behavior.
const deleteFile = async (fileId) => {
  try {
    await getBucket().delete(toObjectId(fileId));
  } catch (error) {
    if (error && /FileNotFound/i.test(error.message || '')) return;
    console.error(`[notes] failed to remove attachment file ${fileId}:`, error.message);
  }
};

const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id));

module.exports = {
  BUCKET_NAME,
  uploadBuffer,
  openDownloadStream,
  deleteFile,
};
