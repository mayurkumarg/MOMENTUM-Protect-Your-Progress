/**
 * LeetCode Platform Adapter
 * Detects accepted submissions and extracts problem data.
 *
 * Requires: shared/dom-utils.js (self.__MomentumDOMUtils)
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  const { normalizeText, isElementVisible, collectVisibleText, findVisibleElementByText, parseDurationTextToSeconds } = self.__MomentumDOMUtils;

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

  // Best-effort — LeetCode's supported language list, matched exactly so we don't
  // pick up unrelated UI text. Not exhaustive; unmatched languages just come back null.
  const KNOWN_LANGUAGES = [
    'C++', 'Java', 'Python', 'Python3', 'C', 'C#', 'JavaScript', 'TypeScript', 'PHP',
    'Swift', 'Kotlin', 'Dart', 'Go', 'Golang', 'Ruby', 'Scala', 'Rust', 'Racket',
    'Erlang', 'Elixir', 'MySQL', 'MS SQL Server', 'Oracle', 'Bash',
  ];

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getSlugFromUrl() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/i);
    return match ? match[1] : '';
  }

  // Reads LeetCode's own elapsed-time display (e.g. "Your Time: 2m 35s") rather than
  // guessing from our own page-load timer — this is the platform's real clock.
  function extractTimerSeconds() {
    const text = normalizeText(collectVisibleText(['div', 'span', 'button']));
    const match = text.match(/your\s*time\s*:?\s*((?:\d+\s*h\s*)?(?:\d+\s*m\s*)?(?:\d+\s*s)?)/i);
    if (!match || !match[1] || !match[1].trim()) return null;
    return parseDurationTextToSeconds(match[1]);
  }

  function extractDifficulty() {
    const el = findVisibleElementByText(/^(Easy|Medium|Hard)$/i, ['div', 'span', 'a', 'button']);
    if (!el) return null;
    const text = normalizeText(el.textContent);
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  function extractLanguage() {
    const pattern = new RegExp(`^(${KNOWN_LANGUAGES.map(escapeRegExp).join('|')})\\s*(?:\\(.*\\))?$`, 'i');
    const el = findVisibleElementByText(pattern, ['button', 'div', 'span']);
    return el ? normalizeText(el.textContent) : null;
  }

  self.__MomentumPlatforms.leetcode = {
    name: 'LeetCode',
    hostMatch: 'leetcode',

    getProblemKey() {
      const slug = getSlugFromUrl();
      return slug ? `LeetCode:${slug}` : `LeetCode:${window.location.pathname}`;
    },

    isSubmitElement(element) {
      const text = normalizeText(`${element.innerText || ''} ${element.value || ''} ${element.getAttribute('aria-label') || ''}`);
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
        const text = normalizeText(mutation.target && mutation.target.textContent);
        if (/accepted|runtime|memory|beats|testcases passed|submission/i.test(text)) return true;
      }
      return false;
    },

    detectSolve(context = {}) {
      const signals = [];
      const resultText = collectVisibleText(RESULT_SELECTORS);
      const bodyText = normalizeText(document.body ? document.body.textContent : '');
      const text = normalizeText(`${resultText} ${bodyText}`);

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

    extractTimerSeconds,

    extractProblemData() {
      const slug = getSlugFromUrl();
      const heading =
        document.querySelector('[data-cy="question-title"]') ||
        document.querySelector('a[href*="/problems/"][class*="title"]') ||
        document.querySelector('h1');

      const titleFromHeading = normalizeText(heading && heading.textContent).replace(/^\d+\.\s*/, '');
      const titleFromDocument = normalizeText(document.title).replace(/\s+-\s+LeetCode.*$/i, '');
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
        difficulty: extractDifficulty(),
        language: extractLanguage(),
      };
    },
  };
})();
