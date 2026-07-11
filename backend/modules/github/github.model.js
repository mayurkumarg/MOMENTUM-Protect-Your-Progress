const mongoose = require('mongoose');

const { Schema } = mongoose;

const repositorySchema = new Schema(
  {
    githubRepoId: Number,
    name: String,
    fullName: String,
    owner: String,
    htmlUrl: String,
    description: String,
    isPrivate: Boolean,
    defaultBranch: String,
    connectedAt: Date,
  },
  { _id: false }
);

const githubIntegrationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
      ref: 'User',
    },
    githubUserId: Number,
    githubUsername: String,
    githubAvatar: String,
    // Encrypted at rest (utils/crypto.js) — never returned by default queries.
    accessToken: {
      type: String,
      select: false,
    },
    scope: String,
    connectedAt: Date,
    repository: {
      type: repositorySchema,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.GithubIntegration || mongoose.model('GithubIntegration', githubIntegrationSchema);
