/**
 * HackerRank Platform Adapter
 * Detects accepted submissions and extracts problem data.
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  const RESULT_SELECTORS = [
    '[data-attr1*="submission"]',
    '[data-analytics*="submission"]',
    '[class*="submission"]',
    '[class*="result"]',
    '[class*="success"]',
    '[class*="accepted"]',
    '[class*="score"]',
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
    const match = window.location.pathname.match(/\/challenges\/([^/]+)/i);
    return match ? match[1] : '';
  }

  function getDifficulty() {
    const text = normalize(document.body && document.body.textContent);
    const match = text.match(/\b(Easy|Medium|Hard)\b/i);
    return match ? match[1] : undefined;
  }

  self.__MomentumPlatforms.hackerrank = {
    name: 'HackerRank',
    hostMatch: 'hackerrank.com',

    getProblemKey() {
      const slug = getSlugFromUrl();
      return slug ? `HackerRank:${slug}` : `HackerRank:${window.location.pathname}`;
    },

    isSubmitElement(element) {
      const text = normalize(`${element.innerText || ''} ${element.value || ''} ${element.getAttribute('aria-label') || ''}`);
      return /\bsubmit\s+code\b|\bsubmit\b/i.test(text) && !/\brun\s+code\b/i.test(text);
    },

    mutationLooksRelevant(mutations) {
      for (const mutation of mutations || []) {
        const text = normalize(mutation.target && mutation.target.textContent);
        if (/accepted|congratulations|score|passed|submission|success/i.test(text)) return true;
      }
      return false;
    },

    detectSolve(context = {}) {
      const signals = [];
      const resultText = collectVisibleResultText();
      const bodyText = normalize(document.body ? document.body.textContent : '');
      const text = normalize(`${resultText} ${bodyText}`);

      const accepted = /\bAccepted\b/i.test(text);
      const congratulations = /\bCongratulations\b/i.test(text);
      const fullScore = /\bScore\s*[: ]\s*\d+(\.0+)?\s*\/\s*\d+/i.test(text) || /\b100\s*%/i.test(text);
      const passed = /\ball\s+test\s+cases\s+passed\b|\btest\s+cases\s+passed\b/i.test(text);

      if (accepted) signals.push('accepted verdict text');
      if (congratulations) signals.push('congratulations text');
      if (fullScore) signals.push('score indicator');
      if (passed) signals.push('test cases passed');

      return {
        solved: !!((accepted || congratulations || fullScore) && (context.freshSubmission || passed || resultText)),
        reason: accepted || congratulations || fullScore
          ? 'HackerRank successful submission confirmed'
          : 'HackerRank success result not present',
        signals,
      };
    },

    extractProblemData() {
      const slug = getSlugFromUrl();
      const heading =
        document.querySelector('h1') ||
        document.querySelector('[data-attr1="challenge-title"]') ||
        document.querySelector('[class*="challenge-title"]');

      const titleFromSlug = slug
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      const title = normalize(heading && heading.textContent) ||
        normalize(document.title).replace(/\s*\|\s*HackerRank.*$/i, '') ||
        titleFromSlug ||
        'Unknown Problem';

      return {
        source: 'DSA',
        platform: 'HackerRank',
        problemTitle: title,
        title,
        difficulty: getDifficulty(),
        problemSlug: slug,
        url: window.location.href,
        solvedAt: new Date().toISOString(),
      };
    },
  };
})();
