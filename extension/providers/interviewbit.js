/**
 * InterviewBit Platform Adapter
 * Detects accepted submissions and extracts problem data.
 *
 * Requires: shared/dom-utils.js (self.__MomentumDOMUtils)
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  const { normalizeText, collectVisibleText } = self.__MomentumDOMUtils;

  const RESULT_SELECTORS = [
    '[class*="accepted"]',
    '[class*="success"]',
    '[class*="result"]',
    '[class*="submission"]',
    '[class*="score"]',
    '[role="dialog"]',
    '[role="alert"]',
  ];

  function getSlugFromUrl() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/i);
    return match ? match[1] : '';
  }

  function getDifficulty() {
    const text = normalizeText(document.body && document.body.textContent);
    const match = text.match(/\b(Easy|Medium|Hard)\b/i);
    return match ? match[1] : undefined;
  }

  self.__MomentumPlatforms.interviewbit = {
    name: 'InterviewBit',
    hostMatch: 'interviewbit.com',

    getProblemKey() {
      const slug = getSlugFromUrl();
      return slug ? `InterviewBit:${slug}` : `InterviewBit:${window.location.pathname}`;
    },

    isSubmitElement(element) {
      const text = normalizeText(`${element.innerText || ''} ${element.value || ''} ${element.getAttribute('aria-label') || ''}`);
      return /\bsubmit\b/i.test(text) && !/\brun\b/i.test(text);
    },

    mutationLooksRelevant(mutations) {
      for (const mutation of mutations || []) {
        const text = normalizeText(mutation.target && mutation.target.textContent);
        if (/accepted|correct|congratulations|success|score|submission|passed/i.test(text)) return true;
      }
      return false;
    },

    detectSolve(context = {}) {
      const signals = [];
      const resultText = collectVisibleText(RESULT_SELECTORS);
      const bodyText = normalizeText(document.body ? document.body.textContent : '');
      const text = normalizeText(`${resultText} ${bodyText}`);

      const accepted = /\bAccepted\b/i.test(text);
      const correct = /\bCorrect\s+Answer\b|\bCorrect\b/i.test(text);
      const congratulations = /\bCongratulations\b/i.test(text);
      const passed = /\ball\s+test\s+cases\s+passed\b|\btest\s+cases\s+passed\b/i.test(text);

      if (accepted) signals.push('accepted verdict text');
      if (correct) signals.push('correct answer text');
      if (congratulations) signals.push('congratulations text');
      if (passed) signals.push('test cases passed');

      return {
        solved: !!((accepted || correct || congratulations) && (context.freshSubmission || passed || resultText)),
        reason: accepted || correct || congratulations
          ? 'InterviewBit successful completion confirmed'
          : 'InterviewBit success result not present',
        signals,
      };
    },

    extractProblemData() {
      const slug = getSlugFromUrl();
      const heading =
        document.querySelector('h1') ||
        document.querySelector('[class*="problem-title"]') ||
        document.querySelector('[class*="ProblemTitle"]');

      const titleFromSlug = slug
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

      const title = normalizeText(heading && heading.textContent) ||
        normalizeText(document.title).replace(/\s*-\s*InterviewBit.*$/i, '') ||
        titleFromSlug ||
        'Unknown Problem';

      return {
        source: 'DSA',
        platform: 'InterviewBit',
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
