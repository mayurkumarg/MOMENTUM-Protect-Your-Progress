/**
 * Momentum Extension — Shared DOM Utilities
 * Extracted from platform providers and content-script.js to eliminate duplication.
 * Exposed on self.__MomentumDOMUtils for use in content script contexts.
 */
(function () {
  function normalizeText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function isElementVisible(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function collectVisibleText(selectors) {
    const chunks = [];
    const seen = new Set();

    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (seen.has(element) || !isElementVisible(element)) continue;
        seen.add(element);
        const text = normalizeText(element.textContent);
        if (text) chunks.push(text);
      }
    }

    return chunks.join(' ');
  }

  function findVisibleElementByText(pattern, selectors) {
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (!isElementVisible(element)) continue;
        if (pattern.test(normalizeText(element.textContent))) return element;
      }
    }
    return null;
  }

  // Parses a duration string into total seconds. Handles two families:
  //   - Colon stopwatch: "00:03:45"/"3:45"/"1:05:00" (3 groups = h:m:s, 2 = m:s)
  //   - Letter format:   "2m 35s", "18m", "1h 05m", "1h 15m 08s", "45s"
  // Returns null if neither shape is present.
  function parseDurationTextToSeconds(text) {
    if (!text) return null;
    const normalized = String(text).trim();

    // Colon stopwatch — the whole candidate must be a clock reading.
    const colon = normalized.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (colon) {
      const a = parseInt(colon[1], 10);
      const b = parseInt(colon[2], 10);
      const c = colon[3] != null ? parseInt(colon[3], 10) : null;
      // 3 groups → h:m:s; 2 groups → m:s
      return c != null ? a * 3600 + b * 60 + c : a * 60 + b;
    }

    // Letter format.
    const hoursMatch = normalized.match(/(\d+)\s*h/i);
    const minutesMatch = normalized.match(/(\d+)\s*m(?!s)/i);
    const secondsMatch = normalized.match(/(\d+)\s*s/i);

    if (!hoursMatch && !minutesMatch && !secondsMatch) return null;

    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
    const seconds = secondsMatch ? parseInt(secondsMatch[1], 10) : 0;

    return hours * 3600 + minutes * 60 + seconds;
  }

  self.__MomentumDOMUtils = {
    normalizeText,
    isElementVisible,
    collectVisibleText,
    findVisibleElementByText,
    parseDurationTextToSeconds,
  };
})();
