const mongoose = require('mongoose');

const { Schema } = mongoose;

// Refresh tokens live in their own collection (not embedded on User) so the
// TTL index below only ever deletes an expired token document — an embedded
// array + TTL index deletes the whole PARENT document once any array value
// expires, which previously caused entire user accounts to be silently wiped
// ~30 days after first login.
const refreshTokenSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // SHA-256 of the token, not the token itself — bcrypt is unnecessary here
  // since the token is already a high-entropy signed JWT, not a low-entropy
  // user-chosen secret.
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
