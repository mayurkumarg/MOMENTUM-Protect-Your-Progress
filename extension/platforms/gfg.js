/**
 * GeeksForGeeks Platform Adapter
 * Detects accepted submissions and extracts problem data.
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  const RESULT_SELECTORS = [
    '.result-status',
    '.status',
    '.success',
    '.accepted',
    '[class*="result"]',
    '[class*="success"]',
    '[class*="accepted"]',
    '[class*="submission"]',
    '[role="dialog"]',
    '[role="alert"]',
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

  self.__MomentumPlatforms.gfg = {
    name: 'GFG',
    hostMatch: 'geeksforgeeks',

    getProblemKey() {
      const slug = getSlugFromUrl();
      return slug ? `GFG:${slug}` : `GFG:${window.location.pathname}`;
    },

    isSubmitElement(element) {
      const text = normalize(`${element.innerText || ''} ${element.value || ''} ${element.getAttribute('aria-label') || ''}`);
      return /\bsubmit\b/i.test(text);
    },

    mutationLooksRelevant(mutations) {
      for (const mutation of mutations || []) {
        const text = normalize(mutation.target && mutation.target.textContent);
        if (/accepted|correct answer|problem solved successfully|time taken|result|submission/i.test(text)) return true;
      }
      return false;
    },

    detectSolve() {
      const signals = [];
      const resultText = collectVisibleResultText();
      const bodyText = normalize(document.body ? document.body.textContent : '');
      const text = normalize(`${resultText} ${bodyText}`);

      const solvedSuccessfully = /problem solved successfully/i.test(text);
      const correctAnswer = /\bcorrect answer\b/i.test(text);
      const accepted = /\baccepted\b/i.test(text);
      const allPassed = /\ball test cases passed\b/i.test(text) || /\btest cases passed\b/i.test(text);
      const timeTaken = /\btime taken\b/i.test(text) || /\bexecution time\b/i.test(text);

      if (solvedSuccessfully) signals.push('problem solved successfully');
      if (correctAnswer) signals.push('correct answer');
      if (accepted) signals.push('accepted verdict text');
      if (allPassed) signals.push('test cases passed');
      if (timeTaken) signals.push('time/execution stat');

      if (solvedSuccessfully || (correctAnswer && (timeTaken || allPassed)) || (accepted && (timeTaken || allPassed || resultText))) {
        return {
          solved: true,
          reason: 'GFG accepted verdict confirmed',
          signals,
        };
      }

      return {
        solved: false,
        reason: 'GFG accepted/correct result not present',
        signals,
      };
    },

    extractProblemData() {
      const slug = getSlugFromUrl();
      const titleFromHeading =
        normalize(document.querySelector('h1') && document.querySelector('h1').textContent) ||
        normalize(document.querySelector('[class*="problemTitle"]') && document.querySelector('[class*="problemTitle"]').textContent);

      const titleFromDocument = normalize(document.title)
        .replace(/\s*\|\s*Practice\s*\|\s*GeeksforGeeks.*$/i, '')
        .replace(/\s*-\s*GeeksforGeeks.*$/i, '');

      const titleFromSlug = slug
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      return {
        platform: 'GFG',
        problemTitle: titleFromHeading || titleFromDocument || titleFromSlug || 'Unknown Problem',
        problemSlug: slug,
        url: window.location.href,
        solvedAt: new Date().toISOString(),
      };
    },
  };
})();
