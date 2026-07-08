const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

// Canonical day-key (local calendar date, YYYY-MM-DD) — every day-bucketing computation
// in this codebase (streaks, heatmap, active-day counts) must key off this, not
// Date#toDateString() or a re-parsed Date, so they can't silently drift apart.
const formatDateKey = (date) => {
  const d = startOfDay(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Current run of consecutive days (ending today or yesterday) present in dayKeys
// (a Set of formatDateKey() strings).
const computeCurrentStreakDays = (dayKeys) => {
  let streak = 0;
  let cursor = startOfDay(new Date());

  if (!dayKeys.has(formatDateKey(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  while (dayKeys.has(formatDateKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  return streak;
};

// Longest run of consecutive days present in dayKeys, scanning back `lookbackDays` from `from`.
const computeLongestStreakDays = (dayKeys, lookbackDays, from = new Date()) => {
  let longest = 0;
  let running = 0;
  let cursor = new Date(startOfDay(from).getTime() - (lookbackDays - 1) * DAY_MS);

  for (let i = 0; i < lookbackDays; i += 1) {
    if (dayKeys.has(formatDateKey(cursor))) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
    cursor = new Date(cursor.getTime() + DAY_MS);
  }

  return longest;
};

module.exports = {
  DAY_MS,
  startOfDay,
  formatDateKey,
  computeCurrentStreakDays,
  computeLongestStreakDays,
};
