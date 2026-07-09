// Pure, I/O-free functions that turn a DSA Activity into journal file content.
// Kept separate from the GitHub API plumbing (githubWriter.js) so the repo's
// structure/formatting can change without touching any network code.

const INDEX_PATH = 'momentum/index.json';
const README_PATH = 'README.md';

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'problem';

const formatDuration = (seconds) => {
  if (!seconds || seconds < 1) return 'Not recorded';
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes === 0) return `${remaining}s`;
  return `${minutes}m ${remaining}s`;
};

const getPlatform = (activity) => activity.metadata?.platform || 'Unknown';
const getDifficulty = (activity) => activity.metadata?.difficulty || 'Unknown';
const getDurationSeconds = (activity) => activity.durationSeconds || activity.durationMinutes * 60;

const buildProblemPath = (activity) =>
  `${getPlatform(activity)}/${getDifficulty(activity)}/${slugify(activity.title)}.md`;

const buildIndexKey = (activity) => `${getPlatform(activity).toLowerCase()}::${activity.title.toLowerCase()}`;

const buildAttemptBlock = (activity) => {
  const date = new Date(activity.activityDate).toISOString().slice(0, 10);
  const duration = formatDuration(getDurationSeconds(activity));
  const approxNote = activity.isEstimatedDuration === false ? '' : ' (approximate)';
  const language = activity.metadata?.language || 'Not recorded';

  return [
    `### Attempt on ${date}`,
    '',
    `- Time taken: ${duration}${approxNote}`,
    `- Language: ${language}`,
    '',
  ].join('\n');
};

const buildProblemMarkdown = (activity, existingContent) => {
  if (existingContent) {
    return `${existingContent.trimEnd()}\n\n${buildAttemptBlock(activity)}`.trimEnd() + '\n';
  }

  const platform = getPlatform(activity);
  const difficulty = getDifficulty(activity);
  const url = activity.metadata?.url;
  const linkLine = url ? `  ·  [Problem link](${url})` : '';

  const header = [
    `# ${activity.title}`,
    '',
    `**Platform:** ${platform}  ·  **Difficulty:** ${difficulty}${linkLine}`,
    '',
    "_Tracked automatically by Momentum. Solution code isn't captured yet — see the journal README for why._",
    '',
    '## Attempts',
    '',
    '',
  ].join('\n');

  return `${header}${buildAttemptBlock(activity)}`.trimEnd() + '\n';
};

const parseIndex = (raw) => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const updateIndex = (entries, activity, path) => {
  const key = buildIndexKey(activity);
  const solvedAt = new Date(activity.activityDate).toISOString();
  const seconds = getDurationSeconds(activity);
  const existing = entries.find((entry) => entry.key === key);

  if (!existing) {
    entries.push({
      key,
      title: activity.title,
      platform: getPlatform(activity),
      difficulty: getDifficulty(activity),
      path,
      url: activity.metadata?.url || null,
      firstSolvedAt: solvedAt,
      lastSolvedAt: solvedAt,
      attempts: 1,
      totalDurationSeconds: seconds,
    });
  } else {
    existing.lastSolvedAt = solvedAt;
    existing.attempts += 1;
    existing.totalDurationSeconds = (existing.totalDurationSeconds || 0) + seconds;
    existing.path = path;
  }

  return entries;
};

const buildReadme = (entries) => {
  const sorted = [...entries].sort((a, b) => new Date(b.lastSolvedAt) - new Date(a.lastSolvedAt));

  const byDifficulty = {};
  const byPlatform = {};
  for (const entry of entries) {
    byDifficulty[entry.difficulty] = (byDifficulty[entry.difficulty] || 0) + 1;
    byPlatform[entry.platform] = (byPlatform[entry.platform] || 0) + 1;
  }

  const difficultyLine = ['Easy', 'Medium', 'Hard', 'Unknown']
    .filter((key) => byDifficulty[key])
    .map((key) => `${key} ${byDifficulty[key]}`)
    .join(' · ');
  const platformLine = Object.entries(byPlatform)
    .map(([platform, count]) => `${platform} ${count}`)
    .join(' · ');

  const rows = sorted.map((entry) => {
    const date = new Date(entry.lastSolvedAt).toISOString().slice(0, 10);
    const attemptsNote = entry.attempts > 1 ? ` (${entry.attempts}x)` : '';
    return `| ${date} | [${entry.title}](${entry.path})${attemptsNote} | ${entry.platform} | ${entry.difficulty} |`;
  });

  return [
    '# DSA Journal',
    '',
    '_Kept up to date automatically by [Momentum](https://github.com) whenever a problem is solved — no manual Git commands needed._',
    '',
    `**Total problems solved:** ${entries.length}`,
    '',
    difficultyLine,
    platformLine,
    '',
    '| Last solved | Problem | Platform | Difficulty |',
    '|---|---|---|---|',
    ...rows,
    '',
    "> **Note:** solution code isn't synced yet. The Momentum browser extension currently records only the problem, platform, difficulty, language and solve time — not the submitted source — so each problem file above is a structured log entry rather than a copy of your code.",
    '',
  ].join('\n');
};

module.exports = {
  INDEX_PATH,
  README_PATH,
  slugify,
  buildProblemPath,
  buildProblemMarkdown,
  parseIndex,
  updateIndex,
  buildReadme,
};
