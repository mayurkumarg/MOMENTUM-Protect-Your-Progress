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

module.exports = mongoose.model('User', userSchema);
