// Content script: unified platform adapter detection engine.
console.log('[Momentum] Content script loaded');

(function () {
  const platforms = self.__MomentumPlatforms || {};

  const SUBMISSION_TIMEOUT_MS = 120 * 1000;
  const DETECTION_RECHECK_MS = 900;
  const STARTUP_QUIET_MS = 2500;
  const SEND_COOLDOWN_MS = 15 * 1000;
  const URL_POLL_MS = 1000;
  const OBSERVER_OPTIONS = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'data-e2e-locator', 'aria-label', 'role'],
  };

  let lastUrl = window.location.href;
  let pageLoadedAt = Date.now();
  let submission = null;
  let notifiedKeys = new Map();
  let sendInFlight = false;
  let retryTimer = null;
  let reconcileTimer = null;
  let submissionExpiryTimer = null;
  let urlPollTimer = null;
  let observer = null;
  let lastRelevantMutationAt = 0;

  function log(...args) {
    console.log('[Momentum]', ...args);
  }

  function warn(...args) {
    console.warn('[Momentum]', ...args);
  }

  function getAdapter() {
    const host = window.location.hostname;
    for (const key of Object.keys(platforms)) {
      const adapter = platforms[key];
      if (adapter && adapter.hostMatch && host.includes(adapter.hostMatch)) {
        return adapter;
      }
    }
    return null;
  }

  function getProblemKey(adapter) {
    if (!adapter) return window.location.href;
    if (typeof adapter.getProblemKey === 'function') {
      return adapter.getProblemKey() || window.location.href;
    }
    return `${adapter.name}:${window.location.origin}${window.location.pathname}`;
  }

  function resetForUrlChange(reason) {
    const adapter = getAdapter();
    const nextKey = getProblemKey(adapter);

    log('URL reset:', reason, {
      from: lastUrl,
      to: window.location.href,
      problemKey: nextKey,
    });

    lastUrl = window.location.href;
    pageLoadedAt = Date.now();
    submission = null;
    sendInFlight = false;
    lastRelevantMutationAt = 0;

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    if (reconcileTimer) {
      clearTimeout(reconcileTimer);
      reconcileTimer = null;
    }

    if (submissionExpiryTimer) {
      clearTimeout(submissionExpiryTimer);
      submissionExpiryTimer = null;
    }

    scheduleReconcile('url reset');
  }

  function checkUrlChange(reason) {
    if (window.location.href !== lastUrl) {
      resetForUrlChange(reason);
      return true;
    }
    return false;
  }

  function markSubmissionStarted(source) {
    const adapter = getAdapter();
    if (!adapter) return;

    const now = Date.now();
    const problemKey = getProblemKey(adapter);

    submission = {
      id: `${problemKey}:${now}`,
      source,
      problemKey,
      startedAt: now,
      expiresAt: now + SUBMISSION_TIMEOUT_MS,
      sawResultMutation: false,
    };

    if (submissionExpiryTimer) clearTimeout(submissionExpiryTimer);
    submissionExpiryTimer = setTimeout(() => {
      if (submission && submission.expiresAt <= Date.now()) {
        log('Submission window expired:', {
          source: submission.source,
          problemKey: submission.problemKey,
          ageMs: Date.now() - submission.startedAt,
        });
        submission = null;
      }
    }, SUBMISSION_TIMEOUT_MS + 500);

    log('Submit detected:', { platform: adapter.name, source, problemKey });
    scheduleReconcile('submit detected');
  }

  function isSubmitTarget(target, adapter) {
    if (!target || !target.closest) return false;

    const element = target.closest('button, input, [role="button"], a');
    if (!element) return false;

    if (adapter && typeof adapter.isSubmitElement === 'function') {
      return adapter.isSubmitElement(element);
    }

    const text = `${element.innerText || ''} ${element.value || ''} ${element.getAttribute('aria-label') || ''}`.trim();
    return /\bsubmit\b/i.test(text) || (element.type && element.type.toLowerCase() === 'submit');
  }

  function attachSubmitDetection() {
    document.addEventListener(
      'click',
      (event) => {
        try {
          const adapter = getAdapter();
          if (!adapter) return;
          if (isSubmitTarget(event.target, adapter)) {
            markSubmissionStarted('click');
          }
        } catch (error) {
          warn('Submit click detection failed:', error);
        }
      },
      true
    );

    document.addEventListener(
      'submit',
      () => {
        try {
          markSubmissionStarted('form submit');
        } catch (error) {
          warn('Form submit detection failed:', error);
        }
      },
      true
    );

    document.addEventListener(
      'keydown',
      (event) => {
        try {
          const adapter = getAdapter();
          if (!adapter || typeof adapter.isSubmitShortcut !== 'function') return;
          if (adapter.isSubmitShortcut(event)) {
            markSubmissionStarted('keyboard shortcut');
          }
        } catch (error) {
          warn('Submit shortcut detection failed:', error);
        }
      },
      true
    );
  }

  function mutationLooksRelevant(mutations, adapter) {
    if (!mutations || mutations.length === 0) return false;

    for (const mutation of mutations) {
      if (mutation.type === 'characterData') {
        const text = mutation.target && mutation.target.textContent;
        if (text && /accepted|correct|runtime|memory|submission|result/i.test(text)) {
          return true;
        }
        continue;
      }

      if (mutation.type === 'attributes') {
        const el = mutation.target;
        const text = `${el && el.textContent ? el.textContent : ''} ${el && el.className ? el.className : ''}`;
        if (/accepted|correct|runtime|memory|submission|result|success/i.test(text)) {
          return true;
        }
        continue;
      }

      for (const node of mutation.addedNodes || []) {
        if (!node) continue;
        const text = node.textContent || '';
        const cls = node.className || '';
        if (/accepted|correct|runtime|memory|submission|result|success/i.test(`${text} ${cls}`)) {
          return true;
        }
      }
    }

    if (adapter && typeof adapter.mutationLooksRelevant === 'function') {
      return adapter.mutationLooksRelevant(mutations);
    }

    return false;
  }

  function scheduleReconcile(reason) {
    if (reconcileTimer) return;
    reconcileTimer = setTimeout(() => {
      reconcileTimer = null;
      evaluateSolve(reason);
    }, DETECTION_RECHECK_MS);
  }

  function callDetectSolve(adapter, context) {
    if (!adapter || typeof adapter.detectSolve !== 'function') return { solved: false, reason: 'adapter has no detectSolve' };

    const result = adapter.detectSolve(context);
    if (typeof result === 'boolean') {
      return { solved: result, reason: result ? 'adapter returned true' : 'adapter returned false' };
    }
    return result || { solved: false, reason: 'adapter returned empty result' };
  }

  function hasActiveFreshSubmission(problemKey) {
    if (!submission) return false;
    if (submission.problemKey !== problemKey) return false;
    return Date.now() <= submission.expiresAt;
  }

  function isInCooldown(problemKey) {
    const lastSentAt = notifiedKeys.get(problemKey) || 0;
    const remainingMs = SEND_COOLDOWN_MS - (Date.now() - lastSentAt);
    if (remainingMs > 0) {
      log('Skipped because cooldown:', { problemKey, remainingMs });
      return true;
    }
    return false;
  }

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

  function getVisibleTextFromSelectors(selectors) {
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

  function detectStrongAcceptedSignal(adapter) {
    const platformName = (adapter && adapter.name ? adapter.name : '').toLowerCase();
    if (!platformName.includes('leetcode')) {
      return { detected: false, reason: 'strong accepted fallback is LeetCode-specific' };
    }

    const resultSelectors = [
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

    const broadVisibleTextSelectors = [
      ...resultSelectors,
      'div',
      'span',
      'p',
      'button',
    ];

    const scopedText = normalizeText(getVisibleTextFromSelectors(resultSelectors));
    const visibleSignalText = normalizeText(getVisibleTextFromSelectors(broadVisibleTextSelectors));
    const text = normalizeText(`${scopedText} ${visibleSignalText}`);

    const hasAccepted = /\bAccepted\b/i.test(text);
    const hasTestcasesPassed = /\b\d+\s*\/\s*\d+\s*testcases\s*passed\b/i.test(text) || /\btestcases\s*passed\b/i.test(text);
    const runtimePanel = findVisibleElementByText(/\bRuntime\b/i, broadVisibleTextSelectors);
    const memoryPanel = findVisibleElementByText(/\bMemory\b/i, broadVisibleTextSelectors);
    const submissionPanel =
      findVisibleElementByText(/\bSubmission Result\b|\btestcases\s*passed\b|\bAccepted\b/i, resultSelectors) ||
      Array.from(document.querySelectorAll('[data-e2e-locator*="submission"], [data-e2e-locator*="result"]')).find(isElementVisible);

    const hasRuntimePanel = !!runtimePanel;
    const hasMemoryPanel = !!memoryPanel;
    const hasSubmissionPanel = !!(submissionPanel && isElementVisible(submissionPanel));
    const detected = hasAccepted && hasTestcasesPassed && hasRuntimePanel && hasMemoryPanel && hasSubmissionPanel;

    return {
      detected,
      reason: detected
        ? 'strong accepted signal fallback confirmed'
        : 'strong accepted signal incomplete',
      signals: [
        hasAccepted ? 'accepted verdict text' : null,
        hasTestcasesPassed ? 'testcases passed text' : null,
        hasRuntimePanel ? 'runtime panel' : null,
        hasMemoryPanel ? 'memory panel' : null,
        hasSubmissionPanel ? 'submission/result panel' : null,
      ].filter(Boolean),
      missing: [
        !hasAccepted ? 'Accepted' : null,
        !hasTestcasesPassed ? 'testcases passed' : null,
        !hasRuntimePanel ? 'Runtime panel' : null,
        !hasMemoryPanel ? 'Memory panel' : null,
        !hasSubmissionPanel ? 'Submission/result panel' : null,
      ].filter(Boolean),
    };
  }

  function evaluateSolve(reason) {
    checkUrlChange('reconcile');

    const adapter = getAdapter();
    if (!adapter) return;

    const problemKey = getProblemKey(adapter);
    const freshSubmission = hasActiveFreshSubmission(problemKey);
    const strongSignal = detectStrongAcceptedSignal(adapter);
    const strongSignalFromRecentMutation = strongSignal.detected && Date.now() - lastRelevantMutationAt < 5000;
    const canEvaluate = freshSubmission || strongSignalFromRecentMutation;
    const context = {
      problemKey,
      freshSubmission,
      strongAcceptedSignal: strongSignal.detected,
      strongSignalFromRecentMutation,
      submission,
      pageAgeMs: Date.now() - pageLoadedAt,
      startupQuietMs: STARTUP_QUIET_MS,
      reason,
      url: window.location.href,
    };

    if (!canEvaluate) {
      log('Detection skipped:', {
        reason,
        platform: adapter.name,
        problemKey,
        why: Date.now() - pageLoadedAt < STARTUP_QUIET_MS ? 'startup quiet period / no submit yet' : 'no fresh submit and no recent strong accepted mutation',
        strongSignalMissing: strongSignal.missing || [],
        strongSignalDetected: strongSignal.detected,
      });
      return;
    }

    if (sendInFlight) {
      log('Skipped because duplicate send is already in flight:', { reason, problemKey });
      return;
    }

    if (isInCooldown(problemKey)) return;

    const detection = callDetectSolve(adapter, context);
    if (!detection.solved && !strongSignalFromRecentMutation) {
      log('Accepted check failed:', {
        reason,
        platform: adapter.name,
        problemKey,
        why: detection.reason || 'no accepted indicators found',
      });
      return;
    }

    if (strongSignalFromRecentMutation && !freshSubmission) {
      log('🎯 Strong accepted signal detected:', {
        platform: adapter.name,
        problemKey,
        signals: strongSignal.signals,
      });
    }

    if (freshSubmission) {
      log('Accepted signal detected after fresh submit:', {
        platform: adapter.name,
        problemKey,
        signals: detection.signals || [],
      });
    }

    const finalDetection = detection.solved
      ? detection
      : {
          solved: true,
          reason: strongSignal.reason,
          signals: strongSignal.signals,
        };

    log('Accepted indicators found:', {
      platform: adapter.name,
      problemKey,
      reason: finalDetection.reason,
      signals: finalDetection.signals || [],
    });

    sendSolved(adapter, problemKey, finalDetection);
  }

  function sendSolved(adapter, problemKey, detection) {
    if (sendInFlight) return;

    const data = adapter.extractProblemData();
    data.platform = data.platform || adapter.name;
    data.url = data.url || window.location.href;
    data.solvedAt = data.solvedAt || new Date().toISOString();
    data.detection = {
      reason: detection.reason || 'accepted indicators found',
      signals: detection.signals || [],
      problemKey,
    };

    sendInFlight = true;
    notifiedKeys.set(problemKey, Date.now());

    log('📤 Sending solve event:', {
      platform: data.platform,
      problemTitle: data.problemTitle,
      problemKey,
    });

    try {
      chrome.runtime.sendMessage({ type: 'PROBLEM_SOLVED', data }, (response) => {
        if (chrome.runtime.lastError) {
          warn('Solve event send failed:', chrome.runtime.lastError.message);
          sendInFlight = false;
          notifiedKeys.delete(problemKey);
          scheduleRetry(adapter, problemKey, detection);
          return;
        }

        if (!response || response.success === false) {
          warn('Solve event rejected by background:', response);
          sendInFlight = false;
          notifiedKeys.delete(problemKey);
          scheduleRetry(adapter, problemKey, detection);
          return;
        }

        log('✅ Solve event sent:', {
          platform: data.platform,
          problemTitle: data.problemTitle,
          problemKey,
        });

        sendInFlight = false;
        submission = null;
      });
    } catch (error) {
      warn('Solve event send threw:', error);
      sendInFlight = false;
      notifiedKeys.delete(problemKey);
      scheduleRetry(adapter, problemKey, detection);
    }
  }

  function scheduleRetry(adapter, problemKey, detection) {
    if (retryTimer) {
      log('Retry already scheduled:', { problemKey });
      return;
    }

    log('Retry triggered:', { problemKey, delayMs: 3000 });
    retryTimer = setTimeout(() => {
      retryTimer = null;
      const currentAdapter = getAdapter();
      const currentProblemKey = getProblemKey(currentAdapter);

      if (!currentAdapter || currentProblemKey !== problemKey) {
        log('Retry skipped:', {
          problemKey,
          currentProblemKey,
          why: 'adapter or problem changed',
        });
        return;
      }

      sendSolved(adapter, problemKey, detection || { reason: 'retry' });
    }, 3000);
  }

  function handleMutations(mutations) {
    if (checkUrlChange('mutation')) return;

    const adapter = getAdapter();
    if (!adapter) return;

    const relevant = mutationLooksRelevant(mutations, adapter);
    if (submission && relevant) {
      submission.sawResultMutation = true;
    }
    if (relevant) {
      lastRelevantMutationAt = Date.now();
    }

    log('Mutation detected:', {
      platform: adapter.name,
      count: mutations.length,
      relevant,
      hasFreshSubmission: !!submission,
    });

    if (relevant || submission) {
      scheduleReconcile(relevant ? 'relevant mutation' : 'submission follow-up mutation');
    }
  }

  function patchHistory() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function () {
      const result = originalPushState.apply(this, arguments);
      setTimeout(() => checkUrlChange('history.pushState'), 0);
      return result;
    };

    history.replaceState = function () {
      const result = originalReplaceState.apply(this, arguments);
      setTimeout(() => checkUrlChange('history.replaceState'), 0);
      return result;
    };

    window.addEventListener('popstate', () => checkUrlChange('popstate'));
    window.addEventListener('hashchange', () => checkUrlChange('hashchange'));
    urlPollTimer = setInterval(() => checkUrlChange('url poll'), URL_POLL_MS);
  }

  function startObserver() {
    if (!document.body) {
      setTimeout(startObserver, 250);
      return;
    }

    observer = new MutationObserver(handleMutations);
    observer.observe(document.body, OBSERVER_OPTIONS);
    log('MutationObserver active');
  }

  attachSubmitDetection();
  patchHistory();
  startObserver();

  setTimeout(() => scheduleReconcile('startup check'), STARTUP_QUIET_MS);

  window.addEventListener('beforeunload', () => {
    if (observer) observer.disconnect();
    if (urlPollTimer) clearInterval(urlPollTimer);
  });
})();
