/**
 * Seeds realistic demo tasks + DSA activity for an existing user, so Analytics has
 * something real to show without weeks of actual usage.
 *
 * Standalone script — not wired into server startup, npm scripts, or any request
 * path. Run manually:
 *
 *   node backend/scripts/seedDemoData.js <your-account-email>
 *
 * Inserts directly via Model.collection.insertMany(), bypassing Mongoose schema
 * validation on purpose — Task's "deadline must be in the future" validator would
 * otherwise reject the overdue/completed tasks this script deliberately backdates.
 * Everything inserted is tagged (tags: ['demo'] on tasks, metadata.demo: true on
 * activities) so it's identifiable and easy to remove later.
 */
require('../config/env');
const connectDB = require('../config/db');
const User = require('../modules/user/user.model');
const Task = require('../modules/task/task.model');
const Activity = require('../modules/activity/activity.model');

const DAY_MS = 24 * 60 * 60 * 1000;
const HEATMAP_WINDOW_DAYS = 98;

// Weighted so LeetCode/Codeforces show up more often, matching typical real usage.
const PLATFORMS = [
  'LeetCode', 'LeetCode', 'LeetCode',
  'Codeforces', 'Codeforces',
  'GFG', 'HackerRank', 'CodeChef', 'AtCoder', 'InterviewBit',
];

const TASKS = [
  ['Finish binary search module', 'DSA'],
  ['Review dynamic programming notes', 'DSA'],
  ['Mock interview prep', 'Interview'],
  ['Solve 5 medium LeetCode problems', 'DSA'],
  ['Read CLRS chapter 12', 'Reading'],
  ['Build portfolio project README', 'Project'],
  ['Refactor personal website', 'Project'],
  ['Practice system design basics', 'Interview'],
  ['Complete graph algorithms sheet', 'DSA'],
  ['Watch OS scheduling lecture', 'Reading'],
  ['Write unit tests for API', 'Project'],
  ['Resume review pass', 'Career'],
  ['Apply to 3 companies', 'Career'],
  ['Solve weekly Codeforces contest', 'DSA'],
  ['Revise SQL joins', 'DSA'],
  ['Set up CI pipeline', 'Project'],
  ['Practice behavioral interview answers', 'Interview'],
  ['Study tries and segment trees', 'DSA'],
  ['Contribute to an open-source repo', 'Project'],
  ['Plan next month goals', 'Planning'],
];

const PROBLEM_TITLES = [
  'Two Sum', 'Add Two Numbers', 'Longest Substring Without Repeating Characters',
  'Median of Two Sorted Arrays', 'Longest Palindromic Substring', 'Reverse Integer',
  'Container With Most Water', '3Sum', 'Letter Combinations of a Phone Number',
  'Remove Nth Node From End of List', 'Valid Parentheses', 'Merge Two Sorted Lists',
  'Search in Rotated Sorted Array', 'Combination Sum', 'Permutations', 'Rotate Image',
  'Group Anagrams', 'Maximum Subarray', 'Jump Game', 'Merge Intervals', 'Unique Paths',
  'Minimum Path Sum', 'Climbing Stairs', 'Word Search', 'Subsets',
  'Binary Tree Inorder Traversal', 'Validate Binary Search Tree', 'Symmetric Tree',
  'Binary Tree Level Order Traversal', 'Maximum Depth of Binary Tree',
  'Convert Sorted Array to Binary Search Tree', 'Path Sum',
  'Best Time to Buy and Sell Stock', 'Longest Consecutive Sequence', 'Single Number',
  'Linked List Cycle', 'LRU Cache', 'Course Schedule', 'Kth Largest Element in an Array',
  'Coin Change',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function buildTaskDocs(userId, now) {
  return TASKS.map(([title, category]) => {
    const roll = Math.random();
    let status = 'PENDING';
    let deadline;
    let completedAt = null;

    if (roll < 0.45) {
      const daysAgo = randomInt(1, 60);
      status = 'COMPLETED';
      completedAt = new Date(now.getTime() - daysAgo * DAY_MS);
      deadline = new Date(completedAt.getTime() + randomInt(0, 5) * DAY_MS);
    } else if (roll < 0.6) {
      deadline = new Date(now.getTime() - randomInt(1, 10) * DAY_MS); // overdue
    } else if (roll < 0.8) {
      deadline = new Date(now.getTime() + randomInt(1, 5) * DAY_MS); // due soon
    } else {
      deadline = new Date(now.getTime() + randomInt(6, 30) * DAY_MS); // future
    }

    const createdAt = new Date(deadline.getTime() - randomInt(2, 10) * DAY_MS);

    return {
      userId,
      title,
      estimatedHours: randomInt(1, 12),
      deadline,
      status,
      completedAt,
      category,
      tags: ['demo'],
      subtasks: [],
      createdAt,
      updatedAt: now,
    };
  });
}

function buildActivityDoc(userId, date) {
  const platform = pick(PLATFORMS);
  const problemTitle = pick(PROBLEM_TITLES);
  const solvedAt = new Date(date);
  solvedAt.setHours(randomInt(8, 22), randomInt(0, 59), 0, 0);

  return {
    userId,
    source: 'DSA',
    activityType: 'CODING',
    title: problemTitle,
    durationMinutes: 1,
    activityDate: solvedAt,
    taskId: null,
    category: null,
    metadata: {
      platform,
      url: `https://example.com/${platform.toLowerCase()}/${problemTitle.toLowerCase().replace(/\s+/g, '-')}`,
      solvedAt: solvedAt.toISOString(),
      demo: true,
    },
    createdAt: solvedAt,
    updatedAt: solvedAt,
  };
}

function buildActivityDocs(userId, now) {
  const docs = [];

  // A genuine current streak ending today, so the heatmap and streak stat read as a real active user.
  const streakLength = randomInt(5, 7);
  for (let dayOffset = 0; dayOffset < streakLength; dayOffset += 1) {
    const date = new Date(now.getTime() - dayOffset * DAY_MS);
    const count = randomInt(1, 3);
    for (let i = 0; i < count; i += 1) {
      const doc = buildActivityDoc(userId, date);
      if (dayOffset === 0 && doc.activityDate > now) doc.activityDate = new Date(now.getTime() - randomInt(5, 180) * 60 * 1000);
      docs.push(doc);
    }
  }

  // Realistic gaps for the rest of the window — most days have nothing, matching real usage.
  for (let dayOffset = streakLength; dayOffset < HEATMAP_WINDOW_DAYS; dayOffset += 1) {
    if (Math.random() > 0.45) continue;
    const date = new Date(now.getTime() - dayOffset * DAY_MS);
    const count = randomInt(1, 3);
    for (let i = 0; i < count; i += 1) {
      docs.push(buildActivityDoc(userId, date));
    }
  }

  return docs;
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: node backend/scripts/seedDemoData.js <your-account-email>');
    process.exitCode = 1;
    return;
  }

  await connectDB();

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exitCode = 1;
    return;
  }

  const now = new Date();
  const taskDocs = buildTaskDocs(user._id, now);
  const activityDocs = buildActivityDocs(user._id, now);

  const [taskResult, activityResult] = await Promise.all([
    Task.collection.insertMany(taskDocs),
    Activity.collection.insertMany(activityDocs),
  ]);

  console.log(`Seeded ${taskResult.insertedCount} demo tasks and ${activityResult.insertedCount} demo activities for ${email}.`);
  console.log("Tagged with tags: ['demo'] (tasks) / metadata.demo: true (activities) for easy identification.");
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
