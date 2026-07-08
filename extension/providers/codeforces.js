/**
 * Codeforces Platform Adapter
 * Detects accepted submissions and extracts problem data.
 *
 * Requires: shared/dom-utils.js (self.__MomentumDOMUtils)
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  const { normalizeText, collectVisibleText } = self.__MomentumDOMUtils;

  const RESULT_SELECTORS = [
    '.status-frame-datatable',
    '.submissionVerdictWrapper',
    '.verdict-accepted',
    '[class*="verdict"]',
    '[class*="status"]',
    '[class*="submission"]',
    '[role="alert"]',
  ];

  function getProblemIdFromUrl() {
    const path = window.location.pathname;
    const contest = path.match(/\/(?:contest|gym)\/(\d+)\/problem\/([A-Z]\d?)/i);
    if (contest) return `${contest[1]}-${contest[2].toUpperCase()}`;

    const problemset = path.match(/\/problemset\/problem\/(\d+)\/([A-Z]\d?)/i);
    if (problemset) return `${problemset[1]}-${problemset[2].toUpperCase()}`;

    return '';
  }

  function getDifficulty() {
    const text = normalizeText(document.body && document.body.textContent);
    const rating = text.match(/\*\s*(\d{3,4})\b/) || text.match(/\b(\d{3,4})\s*rating\b/i);
    return rating ? rating[1] : undefined;
  }

  self.__MomentumPlatforms.codeforces = {
    name: 'Codeforces',
    hostMatch: 'codeforces.com',

    getProblemKey() {
      const id = getProblemIdFromUrl();
      return id ? `Codeforces:${id}` : `Codeforces:${window.location.pathname}`;
    },

    isSubmitElement(element) {
      const text = normalizeText(`${element.innerText || ''} ${element.value || ''} ${element.getAttribute('aria-label') || ''}`);
      return /\bsubmit\b/i.test(text);
    },

    mutationLooksRelevant(mutations) {
      for (const mutation of mutations || []) {
        const text = normalizeText(mutation.target && mutation.target.textContent);
        if (/accepted|verdict|judgement|submission|tests passed/i.test(text)) return true;
      }
      return false;
    },

    detectSolve(context = {}) {
      const signals = [];
      const resultText = collectVisibleText(RESULT_SELECTORS);
      const bodyText = normalizeText(document.body ? document.body.textContent : '');
      const text = normalizeText(`${resultText} ${bodyText}`);

      const accepted = /\bAccepted\b/i.test(text);
      const verdict = /\bVerdict\b/i.test(text) || /\bsubmission\b/i.test(text);
      const testsPassed = /\btests?\s+passed\b/i.test(text);

      if (accepted) signals.push('accepted verdict text');
      if (verdict) signals.push('verdict/submission area');
      if (testsPassed) signals.push('tests passed text');

      return {
        solved: !!(accepted && (context.freshSubmission || verdict || testsPassed || resultText)),
        reason: accepted ? 'Codeforces accepted verdict confirmed' : 'Codeforces accepted verdict not present',
        signals,
      };
    },

    extractProblemData() {
      const id = getProblemIdFromUrl();
      const title =
        normalizeText(document.querySelector('.problem-statement .title') && document.querySelector('.problem-statement .title').textContent)
          .replace(/^[A-Z]\d?\.\s*/i, '') ||
        normalizeText(document.title).replace(/\s*-\s*Codeforces.*$/i, '') ||
        id ||
        'Unknown Problem';

      const difficulty = getDifficulty();

      return {
        source: 'DSA',
        platform: 'Codeforces',
        problemTitle: title,
        title,
        difficulty,
        problemSlug: id,
        url: window.location.href,
        solvedAt: new Date().toISOString(),
      };
    },
  };
})();
