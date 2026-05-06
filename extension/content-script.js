// Content script: detect problem solved on LeetCode and GeeksforGeeks
console.log("🧪 Content script loaded on page");
console.debug('Content script host:', window.location.hostname, 'url:', window.location.href);
(function () {
  let notified = false;  

  function sendSolved(platform) {
    if (notified) return;
    notified = true;

    const data = {
      platform,
      problemTitle: document.title || '',
      url: window.location.href,
      solvedAt: new Date().toISOString(),
    };

    try {
      chrome.runtime.sendMessage({ type: 'PROBLEM_SOLVED', data }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Message failed:', chrome.runtime.lastError);
        } else {
          console.log('✅ Message sent successfully');
        }
      });
    } catch (e) {
      // ignore
    }
  }

  function checkLeetCode() {
    // 1. Look for "Accepted" anywhere BUT ONLY after submission
    const bodyText = document.body.innerText || "";

    if (bodyText.includes("Accepted") && bodyText.includes("testcases passed")) {
      console.log("🎯 Accepted detected (strong signal)");
      return true;
    }

    // 2. Detect runtime + memory panel (very reliable)
    const runtime = document.querySelector('[class*="runtime"]');
    const memory = document.querySelector('[class*="memory"]');

    if (runtime && memory) {
      console.log("🎯 Runtime + Memory detected → accepted");
      return true;
    }

    // 3. Detect submission tab content
    const submissionsTab = document.querySelector('[class*="submission"]');
    if (submissionsTab && submissionsTab.innerText.includes("Accepted")) {
      console.log("🎯 Accepted in submissions tab");
      return true;
    }

    return false;
  }

  function checkGFG() {
    // Look for common success indicators
    const correctText = Array.from(document.querySelectorAll('body *')).some((el) => {
      try {
        return el.innerText && /\bCorrect\b|\bAccepted\b|\bRight Answer\b/i.test(el.innerText);
      } catch (e) {
        return false;
      }
    });

    if (correctText) return true;

    // Check for known classes (best-effort)
    const possible = document.querySelector('.result-status, .status, .success, .accepted');
    return !!possible;
  }

  function check() {
    if (notified) return;

    const host = window.location.hostname;

    if (host.includes('leetcode')) {
      if (checkLeetCode()) sendSolved('LeetCode');
    } else if (host.includes('geeksforgeeks')) {
      if (checkGFG()) sendSolved('GFG');
    }
  }

  // Run initial check
  check();

  // Observe DOM changes
  const observer = new MutationObserver(() => {
    check();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Stop observing after a while to avoid runaway
  setTimeout(() => {
    observer.disconnect();
  }, 5 * 60 * 1000);
})();
