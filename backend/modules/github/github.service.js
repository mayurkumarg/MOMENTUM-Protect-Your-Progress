const axios = require('axios');
const AppError = require('../../utils/AppError');
const { encrypt, decrypt } = require('../../utils/crypto');
const GithubIntegration = require('./github.model');

const serialize = (integration) => {
  if (!integration) {
    return { connected: false, githubUsername: null, githubAvatar: null, connectedAt: null, repository: null };
  }

  return {
    connected: true,
    githubUsername: integration.githubUsername,
    githubAvatar: integration.githubAvatar,
    connectedAt: integration.connectedAt,
    repository: integration.repository || null,
  };
};

const getIntegrationOrThrow = async (userId) => {
  const integration = await GithubIntegration.findOne({ userId }).select('+accessToken');
  if (!integration) {
    throw new AppError('GitHub is not connected.', 400);
  }
  return integration;
};

// Called from the existing GitHub OAuth login flow (auth.service.js) once a
// repo-scoped token comes back — there is no separate connect/callback flow,
// this just records the token issued by that same login.
const upsertIntegrationToken = async (userId, { accessToken, scope, githubUser }) => {
  await GithubIntegration.findOneAndUpdate(
    { userId },
    {
      $set: {
        userId,
        githubUserId: githubUser?.id,
        githubUsername: githubUser?.login,
        githubAvatar: githubUser?.avatar_url,
        accessToken: encrypt(accessToken),
        scope,
        connectedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const getStatus = async (userId) => {
  const integration = await GithubIntegration.findOne({ userId });
  return serialize(integration);
};

// For internal use by the sync engine — returns null (rather than throwing)
// when there's nothing to sync to yet, since that's a routine, expected state.
const getActiveIntegration = async (userId) => {
  const integration = await GithubIntegration.findOne({ userId }).select('+accessToken');
  if (!integration || !integration.repository) return null;

  return {
    token: decrypt(integration.accessToken),
    repository: integration.repository,
  };
};

const listRepos = async (userId) => {
  const integration = await getIntegrationOrThrow(userId);
  const token = decrypt(integration.accessToken);

  try {
    const response = await axios.get('https://api.github.com/user/repos', {
      params: { affiliation: 'owner', sort: 'updated', per_page: 100 },
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
    });

    return response.data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      htmlUrl: repo.html_url,
      description: repo.description,
      private: repo.private,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
    }));
  } catch (error) {
    throw new AppError('Failed to load repositories from GitHub.', 502);
  }
};

const saveRepository = async (userId, repoData) => {
  const repository = {
    githubRepoId: repoData.id,
    name: repoData.name,
    fullName: repoData.full_name,
    owner: repoData.owner.login,
    htmlUrl: repoData.html_url,
    description: repoData.description,
    isPrivate: repoData.private,
    defaultBranch: repoData.default_branch,
    connectedAt: new Date(),
  };

  const integration = await GithubIntegration.findOneAndUpdate(
    { userId },
    { $set: { repository } },
    { new: true }
  );

  return serialize(integration);
};

const createRepo = async (userId, { name, description, isPrivate }) => {
  const integration = await getIntegrationOrThrow(userId);
  const token = decrypt(integration.accessToken);

  try {
    const response = await axios.post(
      'https://api.github.com/user/repos',
      {
        name,
        description: description || 'DSA practice journal, tracked with Momentum.',
        private: Boolean(isPrivate),
        auto_init: true,
      },
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );

    return await saveRepository(userId, response.data);
  } catch (error) {
    if (error.isOperational) throw error;
    if (error.response?.status === 422) {
      throw new AppError('A repository with that name already exists on your GitHub account.', 409);
    }
    throw new AppError('Failed to create repository on GitHub.', 502);
  }
};

const connectExistingRepo = async (userId, { owner, name }) => {
  const integration = await getIntegrationOrThrow(userId);
  const token = decrypt(integration.accessToken);

  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${name}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
    });

    if (!response.data.permissions?.push) {
      throw new AppError("You don't have write access to this repository.", 403);
    }

    return await saveRepository(userId, response.data);
  } catch (error) {
    if (error.isOperational) throw error;
    if (error.response?.status === 404) {
      throw new AppError('Repository not found.', 404);
    }
    throw new AppError('Failed to fetch repository from GitHub.', 502);
  }
};

const disconnect = async (userId) => {
  await GithubIntegration.deleteOne({ userId });
};

// Real commit history straight from GitHub — reflects the repo as it
// actually is (including anything the user committed by hand), not just what
// Momentum's own sync engine did. Fails soft: this is a display nicety for
// the dashboard, not core data, so a GitHub hiccup or an empty repo (409)
// just yields an empty list instead of breaking the whole dashboard.
const listRecentCommits = async (userId, limit = 8) => {
  const integration = await getActiveIntegration(userId);
  if (!integration) return [];

  const { token, repository } = integration;

  try {
    const response = await axios.get(`https://api.github.com/repos/${repository.owner}/${repository.name}/commits`, {
      params: { sha: repository.defaultBranch, per_page: limit },
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
    });

    return response.data.map((commit) => ({
      sha: commit.sha.slice(0, 7),
      message: (commit.commit.message || '').split('\n')[0],
      url: commit.html_url,
      date: commit.commit.author?.date || commit.commit.committer?.date || null,
      author: commit.author?.login || commit.commit.author?.name || 'Unknown',
    }));
  } catch (error) {
    return [];
  }
};

module.exports = {
  upsertIntegrationToken,
  getStatus,
  getActiveIntegration,
  listRepos,
  createRepo,
  connectExistingRepo,
  disconnect,
  listRecentCommits,
};
