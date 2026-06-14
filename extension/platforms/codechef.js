/**
 * CodeChef Platform Adapter
 * Detects accepted submissions and extracts problem data.
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  const RESULT_SELECTORS = [
    '[class*="verdict"]',
    '[class*="accepted"]',
    '[class*="success"]',
    '[class*="result"]',
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
    const match = window.location.pathname.match(/\/(?:problems|submit)\/([^/?#]+)/i);
    return match ? match[1].toUpperCase() : '';
  }

  function getDifficulty() {
    const text = normalize(document.body && document.body.textContent);
    const rating = text.match(/\bDifficulty\s*[: ]\s*(\d{3,4})\b/i) || text.match(/\b(\d{3,4})\s*Difficulty\b/i);
    return rating ? rating[1] : undefined;
  }

  self.__MomentumPlatforms.codechef = {
    name: 'CodeChef',
    hostMatch: 'codechef.com',

    getProblemKey() {
      const slug = getSlugFromUrl();
      return slug ? `CodeChef:${slug}` : `CodeChef:${window.location.pathname}`;
    },

    isSubmitElement(element) {
      const text = normalize(`${element.innerText || ''} ${element.value || ''} ${element.getAttribute('aria-label') || ''}`);
      return /\bsubmit\b/i.test(text) && !/\brun\b/i.test(text);
    },

    mutationLooksRelevant(mutations) {
      for (const mutation of mutations || []) {
        const text = normalize(mutation.target && mutation.target.textContent);
        if (/accepted|correct answer|success|verdict|submission|score/i.test(text)) return true;
      }
      return false;
    },

    detectSolve(context = {}) {
      const signals = [];
      const resultText = collectVisibleResultText();
      const bodyText = normalize(document.body ? document.body.textContent : '');
      const text = normalize(`${resultText} ${bodyText}`);

      const accepted = /\bAccepted\b/i.test(text);
      const correct = /\bCorrect\s+Answer\b/i.test(text);
      const success = /\bSuccessfully\s+submitted\b/i.test(text);
      const verdict = /\bVerdict\b|\bsubmission\b/i.test(text);

      if (accepted) signals.push('accepted verdict text');
      if (correct) signals.push('correct answer text');
      if (success) signals.push('successful submission text');
      if (verdict) signals.push('verdict/submission area');

      return {
        solved: !!((accepted || correct) && (context.freshSubmission || verdict || resultText)),
        reason: accepted || correct ? 'CodeChef accepted verdict confirmed' : 'CodeChef accepted/correct result not present',
        signals,
      };
    },

    extractProblemData() {
      const slug = getSlugFromUrl();
      const heading =
        document.querySelector('h1') ||
        document.querySelector('[class*="problem-title"]') ||
        document.querySelector('[class*="ProblemHeader"]');

      const title = normalize(heading && heading.textContent) ||
        normalize(document.title).replace(/\s*\|\s*CodeChef.*$/i, '') ||
        slug ||
        'Unknown Problem';

      return {
        source: 'DSA',
        platform: 'CodeChef',
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
