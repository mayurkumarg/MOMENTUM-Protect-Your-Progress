/**
 * AtCoder Platform Adapter
 * Detects accepted submissions and extracts problem data.
 *
 * Requires: shared/dom-utils.js (self.__MomentumDOMUtils)
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  const { normalizeText, collectVisibleText } = self.__MomentumDOMUtils;

  const RESULT_SELECTORS = [
    '#judge-status',
    '#submission-status',
    '.label-success',
    '.table',
    '[class*="result"]',
    '[class*="submission"]',
    '[role="alert"]',
  ];

  function getTaskIdFromUrl() {
    const match = window.location.pathname.match(/\/contests\/([^/]+)\/tasks\/([^/]+)/i);
    return match ? `${match[1]}:${match[2]}` : '';
  }

  self.__MomentumPlatforms.atcoder = {
    name: 'AtCoder',
    hostMatch: 'atcoder.jp',

    getProblemKey() {
      const id = getTaskIdFromUrl();
      return id ? `AtCoder:${id}` : `AtCoder:${window.location.pathname}`;
    },

    isSubmitElement(element) {
      const text = normalizeText(`${element.innerText || ''} ${element.value || ''} ${element.getAttribute('aria-label') || ''}`);
      return /\bsubmit\b/i.test(text);
    },

    mutationLooksRelevant(mutations) {
      for (const mutation of mutations || []) {
        const text = normalizeText(mutation.target && mutation.target.textContent);
        if (/\bAC\b|accepted|judg(e|ing)|submission|result/i.test(text)) return true;
      }
      return false;
    },

    detectSolve(context = {}) {
      const signals = [];
      const resultText = collectVisibleText(RESULT_SELECTORS);
      const bodyText = normalizeText(document.body ? document.body.textContent : '');
      const text = normalizeText(`${resultText} ${bodyText}`);

      const accepted = /\bAC\b|\bAccepted\b/i.test(text);
      const status = /\bStatus\b|\bResult\b|\bSubmission\b/i.test(text);

      if (accepted) signals.push('AC/accepted verdict text');
      if (status) signals.push('status/result/submission area');

      return {
        solved: !!(accepted && (context.freshSubmission || status || resultText)),
        reason: accepted ? 'AtCoder AC verdict confirmed' : 'AtCoder AC verdict not present',
        signals,
      };
    },

    extractProblemData() {
      const id = getTaskIdFromUrl();
      const heading =
        document.querySelector('#task-statement span.lang-en h2') ||
        document.querySelector('#task-statement h2') ||
        document.querySelector('h2') ||
        document.querySelector('h1');

      const title = normalizeText(heading && heading.textContent)
        .replace(/^Problem\s+[A-Z]\s*[:.-]\s*/i, '')
        .replace(/^[A-Z]\s*[-.]\s*/i, '') ||
        normalizeText(document.title).replace(/\s*-\s*AtCoder.*$/i, '') ||
        id ||
        'Unknown Problem';

      return {
        source: 'DSA',
        platform: 'AtCoder',
        problemTitle: title,
        title,
        difficulty: undefined,
        problemSlug: id,
        url: window.location.href,
        solvedAt: new Date().toISOString(),
      };
    },
  };
})();
