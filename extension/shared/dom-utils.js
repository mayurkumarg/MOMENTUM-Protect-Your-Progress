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

  self.__MomentumDOMUtils = {
    normalizeText,
    isElementVisible,
    collectVisibleText,
    findVisibleElementByText,
  };
})();
