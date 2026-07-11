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

    // Reminder delivery channel. Default IN_APP preserves today's behavior
    // for every existing user with no migration — the reminder scheduler
    // only sends email for users who explicitly opt into EMAIL or BOTH.
    notificationPreferences: {
      reminderChannel: {
        type: String,
        enum: ['IN_APP', 'EMAIL', 'BOTH'],
        default: 'IN_APP',
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
