/**
 * Codeforces Platform Adapter
 * Detects accepted submissions and extracts problem data.
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  const RESULT_SELECTORS = [
    '.status-frame-datatable',
    '.submissionVerdictWrapper',
    '.verdict-accepted',
    '[class*="verdict"]',
    '[class*="status"]',
    '[class*="submission"]',
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

  function getProblemIdFromUrl() {
    const path = window.location.pathname;
    const contest = path.match(/\/(?:contest|gym)\/(\d+)\/problem\/([A-Z]\d?)/i);
    if (contest) return `${contest[1]}-${contest[2].toUpperCase()}`;

    const problemset = path.match(/\/problemset\/problem\/(\d+)\/([A-Z]\d?)/i);
    if (problemset) return `${problemset[1]}-${problemset[2].toUpperCase()}`;

    return '';
  }

  function getDifficulty() {
    const text = normalize(document.body && document.body.textContent);
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
      const text = normalize(`${element.innerText || ''} ${element.value || ''} ${element.getAttribute('aria-label') || ''}`);
      return /\bsubmit\b/i.test(text);
    },

    mutationLooksRelevant(mutations) {
      for (const mutation of mutations || []) {
        const text = normalize(mutation.target && mutation.target.textContent);
        if (/accepted|verdict|judgement|submission|tests passed/i.test(text)) return true;
      }
      return false;
    },

    detectSolve(context = {}) {
      const signals = [];
      const resultText = collectVisibleResultText();
      const bodyText = normalize(document.body ? document.body.textContent : '');
      const text = normalize(`${resultText} ${bodyText}`);

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
        normalize(document.querySelector('.problem-statement .title') && document.querySelector('.problem-statement .title').textContent)
          .replace(/^[A-Z]\d?\.\s*/i, '') ||
        normalize(document.title).replace(/\s*-\s*Codeforces.*$/i, '') ||
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
