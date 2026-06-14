const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    // Auth Provider
    authProvider: {
      type: String,
      enum: ['github', 'email'],
      required: true,
      default: 'email',
    },

    // Email + Password Auth
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      select: false,
    },

    // GitHub OAuth
    githubId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // Profile
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    avatar: {
      type: String,
    },

    // Token Management
    refreshTokens: [{
      token: String,
      expiresAt: Date,
      createdAt: { type: Date, default: Date.now },
    }],

    // Status
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // Future: Role-based access control
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  {
    timestamps: true,
  }
);

// Index for cleanup of expired tokens
userSchema.index(
  { 'refreshTokens.expiresAt': 1 },
  { sparse: true, expireAfterSeconds: 0 }
);

module.exports = mongoose.model('User', userSchema);
