// Low-level GitHub Git Data API calls. Commits multiple files as ONE atomic
// commit (blob -> tree -> commit -> ref update) instead of the Contents API,
// which would need one commit per file. Retries the whole read-modify-write
// cycle when the branch moved between our read and write (another sync, or a
// manual push, landing at the same moment).

const axios = require('axios');

const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const githubClient = (token) =>
  axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

const getFileContent = async (client, owner, repo, path, ref) => {
  try {
    const { data } = await client.get(`/repos/${owner}/${repo}/contents/${path}`, { params: { ref } });
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (error) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

const getRef = async (client, owner, repo, branch) => {
  const { data } = await client.get(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  return data.object.sha;
};

const getTreeShaForCommit = async (client, owner, repo, commitSha) => {
  const { data } = await client.get(`/repos/${owner}/${repo}/git/commits/${commitSha}`);
  return data.tree.sha;
};

const createBlob = async (client, owner, repo, content) => {
  const { data } = await client.post(`/repos/${owner}/${repo}/git/blobs`, { content, encoding: 'utf-8' });
  return data.sha;
};

const createTree = async (client, owner, repo, baseTreeSha, entries) => {
  const { data } = await client.post(`/repos/${owner}/${repo}/git/trees`, { base_tree: baseTreeSha, tree: entries });
  return data.sha;
};

const createCommit = async (client, owner, repo, message, treeSha, parentSha) => {
  const { data } = await client.post(`/repos/${owner}/${repo}/git/commits`, {
    message,
    tree: treeSha,
    parents: [parentSha],
  });
  return data.sha;
};

const updateRef = async (client, owner, repo, branch, sha) => {
  await client.patch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, { sha, force: false });
};

const isConflict = (error) => error.response?.status === 409 || error.response?.status === 422;
const isTransient = (error) => !error.response || error.response.status >= 500;

/**
 * @param {object} params
 * @param {(ctx: { readFile: (path: string) => Promise<string|null> }) => Promise<Array<{path: string, content: string}>>} params.buildFiles
 */
const commitFiles = async ({ token, owner, repo, branch, message, buildFiles }) => {
  const client = githubClient(token);

  let latestCommitSha;
  try {
    latestCommitSha = await getRef(client, owner, repo, branch);
  } catch (error) {
    // GitHub returns 409 (not 404) for Git Data API calls against a
    // repository with zero commits — this is a permanent condition, not a
    // ref-update conflict, so it must not enter the retry loop below.
    if (error.response?.status === 404 || error.response?.status === 409) {
      throw new Error(
        `Branch "${branch}" has no commits yet on ${owner}/${repo} — the repository looks empty. Add a commit on GitHub (e.g. a README) or use Momentum's "Create repository" option, then retry.`
      );
    }
    throw error;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const baseTreeSha = await getTreeShaForCommit(client, owner, repo, latestCommitSha);

      const files = await buildFiles({
        readFile: (path) => getFileContent(client, owner, repo, path, branch),
      });

      const entries = await Promise.all(
        files.map(async (file) => ({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: await createBlob(client, owner, repo, file.content),
        }))
      );

      const newTreeSha = await createTree(client, owner, repo, baseTreeSha, entries);
      const newCommitSha = await createCommit(client, owner, repo, message, newTreeSha, latestCommitSha);
      await updateRef(client, owner, repo, branch, newCommitSha);

      return { commitSha: newCommitSha };
    } catch (error) {
      const retryable = isConflict(error) || isTransient(error);
      if (retryable && attempt < MAX_ATTEMPTS) {
        if (isConflict(error)) {
          latestCommitSha = await getRef(client, owner, repo, branch);
        }
        await sleep(attempt * 500);
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to update GitHub repository after multiple attempts.');
};

module.exports = { commitFiles };
