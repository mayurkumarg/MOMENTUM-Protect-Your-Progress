/**
 * LeetCode Platform Adapter
 * Detects accepted submissions and extracts problem data.
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  const RESULT_SELECTORS = [
    '[data-e2e-locator*="submission"]',
    '[data-e2e-locator*="result"]',
    '[data-e2e-locator*="console"]',
    '[class*="submission"]',
    '[class*="result"]',
    '[class*="success"]',
    '[class*="accepted"]',
    '[class*="runtime"]',
    '[class*="memory"]',
    '[role="dialog"]',
  ];

  function normalize(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function collectVisibleResultText() {
    const pieces = [];
    const seen = new Set();

    for (const selector of RESULT_SELECTORS) {
      for (const el of document.querySelectorAll(selector)) {
        if (seen.has(el) || !isVisible(el)) continue;
        seen.add(el);
        const text = normalize(el.textContent);
        if (text) pieces.push(text);
      }
    }

    return pieces.join(' ');
  }

  function getSlugFromUrl() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/i);
    return match ? match[1] : '';
  }

  self.__MomentumPlatforms.leetcode = {
    name: 'LeetCode',
    hostMatch: 'leetcode',

    getProblemKey() {
      const slug = getSlugFromUrl();
      return slug ? `LeetCode:${slug}` : `LeetCode:${window.location.pathname}`;
    },

    isSubmitElement(element) {
      const text = normalize(`${element.innerText || ''} ${element.value || ''} ${element.getAttribute('aria-label') || ''}`);
      if (!/\bsubmit\b/i.test(text)) return false;

      const runOnly = /\brun\b/i.test(text) && !/\bsubmit\b/i.test(text);
      if (runOnly) return false;

      return true;
    },

    isSubmitShortcut(event) {
      return (event.ctrlKey || event.metaKey) && event.key === 'Enter';
    },

    mutationLooksRelevant(mutations) {
      for (const mutation of mutations || []) {
        const text = normalize(mutation.target && mutation.target.textContent);
        if (/accepted|runtime|memory|beats|testcases passed|submission/i.test(text)) return true;
      }
      return false;
    },

    detectSolve(context = {}) {
      const signals = [];
      const resultText = collectVisibleResultText();
      const bodyText = normalize(document.body ? document.body.textContent : '');
      const text = normalize(`${resultText} ${bodyText}`);

      const hasAccepted = /\bAccepted\b/i.test(text);
      const hasRuntime = /\bRuntime\b/i.test(text);
      const hasMemory = /\bMemory\b/i.test(text);
      const hasBeats = /\bBeats\b/i.test(text);
      const hasPassed = /\b\d+\s*\/\s*\d+\s*testcases\s*passed\b/i.test(text) || /\btestcases\s*passed\b/i.test(text);
      const hasSubmissionResult = /submission\s+result/i.test(text);

      if (hasAccepted) signals.push('accepted verdict text');
      if (hasRuntime) signals.push('runtime stat');
      if (hasMemory) signals.push('memory stat');
      if (hasBeats) signals.push('beats stat');
      if (hasPassed) signals.push('testcases passed');
      if (hasSubmissionResult) signals.push('submission result area');

      if (!hasAccepted) {
        return {
          solved: false,
          reason: 'Accepted verdict not present in visible result text',
          signals,
        };
      }

      if (hasPassed || (hasRuntime && hasMemory) || hasBeats || hasSubmissionResult) {
        return {
          solved: true,
          reason: 'LeetCode accepted verdict confirmed with result stats',
          signals,
        };
      }

      const enoughContextAfterFreshSubmit =
        context.freshSubmission && resultText && /\bAccepted\b/i.test(resultText);

      return {
        solved: enoughContextAfterFreshSubmit,
        reason: enoughContextAfterFreshSubmit
          ? 'LeetCode accepted verdict visible in result area after fresh submit'
          : 'Accepted text found without runtime/memory/testcase confirmation',
        signals,
      };
    },

    extractProblemData() {
      const slug = getSlugFromUrl();
      const heading =
        document.querySelector('[data-cy="question-title"]') ||
        document.querySelector('a[href*="/problems/"][class*="title"]') ||
        document.querySelector('h1');

      const titleFromHeading = normalize(heading && heading.textContent).replace(/^\d+\.\s*/, '');
      const titleFromDocument = normalize(document.title).replace(/\s+-\s+LeetCode.*$/i, '');
      const titleFromSlug = slug
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      return {
        platform: 'LeetCode',
        problemTitle: titleFromHeading || titleFromDocument || titleFromSlug || 'Unknown Problem',
        problemSlug: slug,
        url: window.location.href,
        solvedAt: new Date().toISOString(),
      };
    },
  };
})();
