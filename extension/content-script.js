// Content script: unified platform adapter detection engine
console.log('[Momentum] Content script loaded');
console.debug('[Momentum] Host:', window.location.hostname, 'URL:', window.location.href);

(function () {
  const platforms = self.__MomentumPlatforms || {};
  let notified = false;

  function getAdapter() {
    const host = window.location.hostname;
    for (const key of Object.keys(platforms)) {
      if (host.includes(platforms[key].hostMatch)) {
        return platforms[key];
      }
    }
    return null;
  }

  function sendSolved(adapter) {
    if (notified) return;
    notified = true;

    const data = adapter.extractProblemData();
    console.log('[Momentum] 📤 Sending solve event:', adapter.name, '-', data.problemTitle);

    try {
      chrome.runtime.sendMessage({ type: 'PROBLEM_SOLVED', data }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Momentum] Message failed:', chrome.runtime.lastError);
          notified = false; // allow retry on failure
        } else {
          console.log('[Momentum] ✅ Solve event sent');
        }
      });
    } catch (e) {
      notified = false; // allow retry on failure
    }
  }

  function check() {
    if (notified) return;
    const adapter = getAdapter();
    if (adapter && adapter.detectSolve()) {
      sendSolved(adapter);
    }
  }

  // Run initial check
  check();

  // Observe DOM changes — always active
  const observer = new MutationObserver(() => check());
  observer.observe(document.body, { childList: true, subtree: true });

  // Stop observing after 5 minutes to avoid runaway
  setTimeout(() => observer.disconnect(), 5 * 60 * 1000);
})();
