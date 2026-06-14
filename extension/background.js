console.log('🔥 Background script started');

// ── Import reliability modules (must be top-level in MV3 service worker) ──
importScripts('background/logger.js');
importScripts('background/activityQueue.js');
importScripts('background/activityManager.js');

const BACKEND_AUTH_URL = 'http://localhost:5000/api/auth/github';

// ═══════════════════════════════════════════════════════════════════════
// OAUTH FLOW
// ═══════════════════════════════════════════════════════════════════════

function performOAuth(sendResponse) {
  chrome.identity.launchWebAuthFlow(
    {
      url: BACKEND_AUTH_URL,
      interactive: true,
    },
    (responseUrl) => {
      if (chrome.runtime.lastError || !responseUrl) {
        const message =
          chrome.runtime.lastError?.message || 'Authorization did not complete.';
        console.error('OAuth launch failed:', message);
        notifyPopup({ action: 'LOGIN_ERROR', message });
        sendResponse({ success: false, message });
        return;
      }

      try {
        const finalUrl = new URL(responseUrl);
        const token = finalUrl.searchParams.get('token');

        if (!token) {
          throw new Error('Invalid response from server');
        }

        const user = decodeJWT(token);

        chrome.storage.local.set({ token, accessToken: token, user }, () => {
          notifyPopup({ action: 'LOGIN_SUCCESS', user });
          sendResponse({ success: true, user });
        });
      } catch (error) {
        const message = error.message || 'Authentication failed';
        console.error('OAuth response handling failed:', error);
        notifyPopup({ action: 'LOGIN_ERROR', message });
        sendResponse({ success: false, message });
      }
    }
  );
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return {
      userId: payload.userId,
      githubId: payload.githubId,
    };
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

function notifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Popup may not be open
    console.log('Popup not open, message queued');
  });
}

// ═══════════════════════════════════════════════════════════════════════
// UNIFIED MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Popup OAuth request
  if (request.action === 'PERFORM_OAUTH') {
    performOAuth(sendResponse);
    return true;
  }

  // Token request
  if (request.action === 'GET_TOKEN') {
    chrome.storage.local.get(['token', 'accessToken'], (result) => {
      sendResponse({ token: result.token || result.accessToken || null });
    });
    return true;
  }

  // Logout request
  if (request.action === 'LOGOUT') {
    chrome.storage.local.remove(['token', 'accessToken', 'refreshToken', 'user'], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Activity pipeline
  if (request.type === 'PROBLEM_SOLVED') {
    MomentumLogger.info('PROBLEM_SOLVED received:', request.data.problemTitle);

    ActivityManager.handleActivity(request.data)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((err) => {
        MomentumLogger.error('Activity handling failed:', err.message);
        sendResponse({ success: false });
      });

    return true; // keep message channel open for async response
  }
});

// ═══════════════════════════════════════════════════════════════════════
// STORAGE CHANGE LISTENER
// ═══════════════════════════════════════════════════════════════════════

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.token) {
      console.log('Token updated in storage');
    }
    if (changes.accessToken) {
      console.log('Access token updated in storage');
    }
    if (changes.user) {
      console.log('User info updated in storage');
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════
// QUEUE FLUSH — On startup + periodic alarm
// ═══════════════════════════════════════════════════════════════════════

// Flush on service worker startup
ActivityManager.flushQueue();

// Periodic flush every 5 minutes
chrome.alarms.create('momentumFlushQueue', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'momentumFlushQueue') {
    MomentumLogger.debug('Alarm triggered — flushing queue');
    ActivityManager.flushQueue();
  }
});
