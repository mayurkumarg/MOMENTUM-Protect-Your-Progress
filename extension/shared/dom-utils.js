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

  // Parses a duration string like "2m 35s", "18m 12s", "1h 05m", or "45s" into
  // total seconds. Returns null if no hour/minute/second component is found.
  function parseDurationTextToSeconds(text) {
    if (!text) return null;
    const normalized = String(text).trim();
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
