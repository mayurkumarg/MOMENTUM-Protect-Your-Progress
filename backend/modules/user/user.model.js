const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    githubId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    avatar: {
      type: String,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
