/**
 * Momentum Extension — Unified Platform Detection Engine
 * Observes DOM mutations and submit events to detect accepted submissions
 * across all supported coding platforms.
 *
 * Requires:
 *   config/constants.js    (self.__MomentumConfig)
 *   shared/dom-utils.js    (self.__MomentumDOMUtils)
 *   providers/*.js          (self.__MomentumPlatforms)
 */
console.log('[Momentum] Content script loaded');

(function () {
  const platforms = self.__MomentumPlatforms || {};
  const config = self.__MomentumConfig;
  const { normalizeText, isElementVisible, collectVisibleText, findVisibleElementByText } = self.__MomentumDOMUtils;

  const TIMING = config.CONTENT_SCRIPT_TIMING;

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
  // The platform's own timer reading, captured at submit time (when the editor
  // toolbar is guaranteed visible) — the accurate "time taken to solve". Reset per problem.
  let capturedTimerSeconds = null;

  let shuttingDown = false;

  function log(...args) {
    console.log('[Momentum]', ...args);
  }

  function warn(...args) {
    console.warn('[Momentum]', ...args);
  }

  // Reloading/updating/removing the extension orphans the content scripts
  // already injected into open tabs: the page keeps running this code but its
  // chrome.runtime is torn down, so every messaging call throws
  // "Cannot read properties of undefined (reading 'sendMessage')". Nothing
  // here can recover — only a page reload re-injects a live script — so detect
  // it and stop cleanly instead of throwing on a retry loop forever.
  function isExtensionAlive() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch {
      return false;
    }
  }

  function shutdown(reason) {
    if (shuttingDown) return;
    shuttingDown = true;

    log(`Extension context is gone (${reason}) — this tab's tracking has stopped. Reload the page to resume.`);

    if (observer) observer.disconnect();
    if (urlPollTimer) clearInterval(urlPollTimer);
    if (retryTimer) clearTimeout(retryTimer);
    if (reconcileTimer) clearTimeout(reconcileTimer);
    if (submissionExpiryTimer) clearTimeout(submissionExpiryTimer);

    observer = null;
    urlPollTimer = null;
    retryTimer = null;
    reconcileTimer = null;
    submissionExpiryTimer = null;
    sendInFlight = false;
  }

  function getAdapter() {
    const platformKey = detectPlatform();
    return platformKey ? platforms[platformKey] : null;
  }

  function detectPlatform() {
    const host = window.location.hostname;
    for (const key of Object.keys(platforms)) {
      const adapter = platforms[key];
      if (adapter && adapter.hostMatch && host.includes(adapter.hostMatch)) {
        return key;
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

  // Records when a problem was first seen, in chrome.storage.local so it survives
  // page reloads and service-worker restarts (in-memory timers can't). Only writes
  // if the key isn't already present, so revisiting a problem across multiple
  // sessions still measures from the true first visit.
  async function ensureProblemSession(problemKey) {
    if (!problemKey) return;
    try {
      const storageKey = config.STORAGE_KEYS.PROBLEM_SESSIONS;
      const result = await chrome.storage.local.get([storageKey]);
      const sessions = result[storageKey] || {};
      const now = Date.now();
      let changed = false;

      for (const key of Object.keys(sessions)) {
        if (now - sessions[key].firstSeenAt > TIMING.PROBLEM_SESSION_TTL_MS) {
          delete sessions[key];
          changed = true;
        }
      }

      if (!sessions[problemKey]) {
        sessions[problemKey] = { firstSeenAt: now };
        changed = true;
      }

      if (changed) {
        await chrome.storage.local.set({ [storageKey]: sessions });
      }
    } catch (error) {
      warn('Failed to record problem session:', error);
    }
  }

  function clampDuration(minutes) {
    const min = TIMING.MIN_SOLVE_DURATION_MINUTES;
    const max = TIMING.MAX_SOLVE_DURATION_MINUTES;
    if (!Number.isFinite(minutes)) return min;
    return Math.min(Math.max(minutes, min), max);
  }

  // Reads the platform's own on-page timer (if the adapter supports it) and stores
  // the latest good reading. Called at submit time — when the editor toolbar (and its
  // timer) is guaranteed visible — so we don't miss it if the result view hides the
  // timer later. Never throws.
  function captureTimer(adapter) {
    try {
      if (!adapter || typeof adapter.extractTimerSeconds !== 'function') return;
      const seconds = adapter.extractTimerSeconds();
      if (Number.isFinite(seconds) && seconds > 0) {
        capturedTimerSeconds = seconds;
      }
    } catch (error) {
      warn('[Momentum][duration] captureTimer failed:', error);
    }
  }

  // Falls back to the in-memory pageLoadedAt (this-session clock) if no stored
  // session is found, so a solve still gets a real elapsed time rather than a
  // fabricated one.
  async function computeDurationMinutes(problemKey) {
    const fallbackMinutes = clampDuration(Math.round((Date.now() - pageLoadedAt) / 60000));
    try {
      const storageKey = config.STORAGE_KEYS.PROBLEM_SESSIONS;
      const result = await chrome.storage.local.get([storageKey]);
      const sessions = result[storageKey] || {};
      const session = sessions[problemKey];
      if (!session || !session.firstSeenAt) return fallbackMinutes;
      return clampDuration(Math.round((Date.now() - session.firstSeenAt) / 60000));
    } catch (error) {
      warn('Failed to read problem session for duration:', error);
      return fallbackMinutes;
    }
  }

  async function clearProblemSession(problemKey) {
    try {
      const storageKey = config.STORAGE_KEYS.PROBLEM_SESSIONS;
      const result = await chrome.storage.local.get([storageKey]);
      const sessions = result[storageKey] || {};
      if (sessions[problemKey]) {
        delete sessions[problemKey];
        await chrome.storage.local.set({ [storageKey]: sessions });
      }
    } catch (error) {
      warn('Failed to clear problem session:', error);
    }
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
    capturedTimerSeconds = null;

    if (adapter) ensureProblemSession(nextKey);

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

    // Read the platform's own elapsed-time now, while the editor toolbar is still
    // on screen — the submission result view may hide it moments later.
    captureTimer(adapter);

    submission = {
      id: `${problemKey}:${now}`,
      source,
      problemKey,
      startedAt: now,
      expiresAt: now + TIMING.SUBMISSION_TIMEOUT_MS,
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
    }, TIMING.SUBMISSION_TIMEOUT_MS + 500);

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
    }, TIMING.DETECTION_RECHECK_MS);
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
    const remainingMs = TIMING.SEND_COOLDOWN_MS - (Date.now() - lastSentAt);
    if (remainingMs > 0) {
      log('Skipped because cooldown:', { problemKey, remainingMs });
      return true;
    }
    return false;
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

    const scopedText = normalizeText(collectVisibleText(resultSelectors));
    const visibleSignalText = normalizeText(collectVisibleText(broadVisibleTextSelectors));
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
      startupQuietMs: TIMING.STARTUP_QUIET_MS,
      reason,
      url: window.location.href,
    };

    if (!canEvaluate) {
      log('Detection skipped:', {
        reason,
        platform: adapter.name,
        problemKey,
        why: Date.now() - pageLoadedAt < TIMING.STARTUP_QUIET_MS ? 'startup quiet period / no submit yet' : 'no fresh submit and no recent strong accepted mutation',
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

  async function sendSolved(adapter, problemKey, detection) {
    if (sendInFlight) return;

    // Metadata extraction must never be able to abort the send — a solve going
    // uncaptured is worse than a solve with a thin payload.
    let data;
    try {
      data = adapter.extractProblemData() || {};
    } catch (error) {
      warn('extractProblemData failed, sending minimal payload:', error);
      data = {};
    }
    data.platform = data.platform || adapter.name;
    data.url = data.url || window.location.href;
    data.solvedAt = data.solvedAt || new Date().toISOString();

    // Prefer the platform's own timer: the value captured at submit time, else a
    // fresh read now. Fall back to our wall-clock estimate (marked estimated) only
    // when the platform shows no timer at all.
    if (capturedTimerSeconds == null) {
      captureTimer(adapter);
    }
    if (Number.isFinite(capturedTimerSeconds) && capturedTimerSeconds > 0) {
      data.durationSeconds = capturedTimerSeconds;
      data.durationMinutes = clampDuration(Math.round(capturedTimerSeconds / 60));
      data.isEstimatedDuration = false;
    } else {
      data.durationMinutes = await computeDurationMinutes(problemKey);
      data.isEstimatedDuration = true;
    }

    data.detection = {
      reason: detection.reason || 'accepted indicators found',
      signals: detection.signals || [],
      problemKey,
    };

    if (sendInFlight) return;
    sendInFlight = true;
    notifiedKeys.set(problemKey, Date.now());

    log('📤 Sending solve event:', {
      platform: data.platform,
      problemTitle: data.problemTitle,
      problemKey,
    });

    if (!isExtensionAlive()) {
      shutdown('solve event could not be sent');
      return;
    }

    try {
      chrome.runtime.sendMessage({ type: config.MESSAGE_ACTIONS.PROBLEM_SOLVED, data }, (response) => {
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
          durationMinutes: data.durationMinutes,
        });

        sendInFlight = false;
        submission = null;
        clearProblemSession(problemKey);
      });
    } catch (error) {
      sendInFlight = false;
      notifiedKeys.delete(problemKey);

      // A dead context throws here too, and retrying can never succeed.
      if (!isExtensionAlive()) {
        shutdown('solve event send threw');
        return;
      }

      warn('Solve event send threw:', error);
      scheduleRetry(adapter, problemKey, detection);
    }
  }

  function scheduleRetry(adapter, problemKey, detection) {
    if (shuttingDown || !isExtensionAlive()) {
      shutdown('retry requested');
      return;
    }

    if (retryTimer) {
      log('Retry already scheduled:', { problemKey });
      return;
    }

    log('Retry triggered:', { problemKey, delayMs: TIMING.RETRY_DELAY_MS });
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
    }, TIMING.RETRY_DELAY_MS);
  }

  function handleMutations(mutations) {
    if (shuttingDown) return;

    // The observer keeps firing on an orphaned script even though nothing it
    // detects can be reported. Stop at the source rather than downstream.
    if (!isExtensionAlive()) {
      shutdown('page still being observed');
      return;
    }

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
    urlPollTimer = setInterval(() => checkUrlChange('url poll'), TIMING.URL_POLL_MS);
  }

  function startObserver() {
    if (!document.body) {
      setTimeout(startObserver, 250);
      return;
    }

    observer = new MutationObserver(handleMutations);
    observer.observe(document.body, config.OBSERVER_OPTIONS);
    log('MutationObserver active');
  }

  attachSubmitDetection();
  patchHistory();
  startObserver();

  const initialAdapter = getAdapter();
  if (initialAdapter) ensureProblemSession(getProblemKey(initialAdapter));

  setTimeout(() => scheduleReconcile('startup check'), TIMING.STARTUP_QUIET_MS);

  window.addEventListener('online', () => {
    if (shuttingDown) return;
    if (!isExtensionAlive()) {
      shutdown('network restored');
      return;
    }

    log('Network restored (online), requesting queue flush...');
    try {
      chrome.runtime.sendMessage({ type: config.MESSAGE_ACTIONS.FLUSH_QUEUE });
    } catch (e) {
      warn('Failed to send FLUSH_QUEUE message:', e);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (observer) observer.disconnect();
    if (urlPollTimer) clearInterval(urlPollTimer);
  });
})();
