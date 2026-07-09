/**
 * GeeksForGeeks Platform Adapter
 * Detects accepted submissions and extracts problem data.
 *
 * Requires: shared/dom-utils.js (self.__MomentumDOMUtils)
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  const { normalizeText, collectVisibleText, findVisibleElementByText, parseDurationTextToSeconds } = self.__MomentumDOMUtils;

  // GFG's practice IDE shows an elapsed-time label ("Your Time: 2m 35s") in the
  // editor toolbar. Read that; also handle a bare "HH:MM:SS"/"MM:SS" clock as a
  // fallback. Defensive: any failure returns null so it never breaks detection.
  function extractTimerSeconds() {
    try {
      const labeled = normalizeText(collectVisibleText(['[class*="time"]', '[class*="timer"]', 'header', 'nav']));
      const match = labeled.match(/(?:your\s*time|time\s*taken)\s*:?\s*((?:\d+\s*h\s*)?(?:\d+\s*m\s*)?(?:\d+\s*s)?)/i);
      if (match && match[1] && match[1].trim()) {
        const seconds = parseDurationTextToSeconds(match[1]);
        console.log('[Momentum][duration] GFG timer candidate (labeled):', JSON.stringify(match[1]), '=>', seconds);
        if (Number.isFinite(seconds) && seconds > 0) return seconds;
      }

      const clockEl = findVisibleElementByText(/^\d{1,2}:\d{1,2}(?::\d{1,2})?$/, ['span', 'div']);
      if (clockEl) {
        const raw = normalizeText(clockEl.textContent);
        const seconds = parseDurationTextToSeconds(raw);
        console.log('[Momentum][duration] GFG timer candidate (clock):', JSON.stringify(raw), '=>', seconds);
        if (Number.isFinite(seconds) && seconds > 0) return seconds;
      }

      return null;
    } catch (error) {
      console.warn('[Momentum][duration] GFG timer extraction failed:', error);
      return null;
    }
  }

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
      const text = normalizeText(`${element.innerText || ''} ${element.value || ''} ${element.getAttribute('aria-label') || ''}`);
      return /\bsubmit\b/i.test(text);
    },

    mutationLooksRelevant(mutations) {
      for (const mutation of mutations || []) {
        const text = normalizeText(mutation.target && mutation.target.textContent);
        if (/accepted|correct answer|problem solved successfully|time taken|result|submission/i.test(text)) return true;
      }
      return false;
    },

    detectSolve() {
      const signals = [];
      const resultText = collectVisibleText(RESULT_SELECTORS);
      const bodyText = normalizeText(document.body ? document.body.textContent : '');
      const text = normalizeText(`${resultText} ${bodyText}`);

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

    extractTimerSeconds,

    extractProblemData() {
      const slug = getSlugFromUrl();
      const titleFromHeading =
        normalizeText(document.querySelector('h1') && document.querySelector('h1').textContent) ||
        normalizeText(document.querySelector('[class*="problemTitle"]') && document.querySelector('[class*="problemTitle"]').textContent);

      const titleFromDocument = normalizeText(document.title)
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
