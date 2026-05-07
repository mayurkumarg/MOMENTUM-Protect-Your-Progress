/**
 * LeetCode Platform Adapter
 * Detects accepted submissions and extracts problem data.
 *
 * Detection strategy (hybrid):
 *   Condition A — body text contains "Accepted" AND "testcases passed"
 *   Condition B — at least ONE result panel element exists (runtime / memory / submission)
 *   Both A AND B must be true → prevents false positives from stale DOM.
 *
 * Cooldown: 15 seconds between detections to ignore re-renders of old results.
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  let lastAcceptedAt = 0;

  self.__MomentumPlatforms.leetcode = {
    name: 'LeetCode',
    hostMatch: 'leetcode',

    detectSolve() {
      // ── Cooldown: ignore rapid re-detections from DOM churn ────────
      const now = Date.now();
      if (now - lastAcceptedAt < 15000) {
        return false;
      }

      // ── Condition A: strong text signal ────────────────────────────
      const bodyText = document.body.innerText || '';
      const hasAcceptedText =
        bodyText.includes('Accepted') && bodyText.includes('testcases passed');

      if (!hasAcceptedText) return false;

      // ── Condition B: result panel DOM element exists ───────────────
      const runtime = document.querySelector('[class*="runtime"]');
      const memory = document.querySelector('[class*="memory"]');
      const submission = document.querySelector('[class*="submission"]');
      const hasResultPanel = !!(runtime || memory || submission);

      if (!hasResultPanel) return false;

      // ── Both conditions met → genuine accepted submission ─────────
      lastAcceptedAt = now;
      console.log('🎯 Accepted detected (production)');
      return true;
    },

    extractProblemData() {
      return {
        platform: 'LeetCode',
        problemTitle: document.title || '',
        url: window.location.href,
        solvedAt: new Date().toISOString(),
      };
    },
  };
})();
