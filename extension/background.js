console.log('🔥 Background script started');

// ── Import reliability modules (must be top-level in MV3 service worker) ──
importScripts('config/env.js');
importScripts('config/constants.js');
importScripts('utils/jwt.js');
importScripts('storage/storage-service.js');
importScripts('messaging/messaging-service.js');
importScripts('auth/oauth.js');
importScripts('background/logger.js');
importScripts('background/activityQueue.js');
importScripts('background/activityManager.js');

const config = self.__MomentumConfig;
const ACTIONS = config.MESSAGE_ACTIONS;
const storage = self.__MomentumStorage;
const jwt = self.__MomentumJWT;
const oauth = self.__MomentumOAuth;

// ═══════════════════════════════════════════════════════════════════════
// UNIFIED MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Popup OAuth request
  if (request.action === ACTIONS.PERFORM_OAUTH) {
    oauth.performOAuth(sendResponse);
    return true; // keep channel open
  }

  // Token request
  if (request.action === ACTIONS.GET_TOKEN) {
    storage.getTokens().then((tokens) => {
      sendResponse({ token: tokens.accessToken || null });
    });
    return true;
  }

  // Status check for content scripts & popup
  if (request.action === ACTIONS.GET_STATUS) {
    storage.getUser().then((user) => {
      sendResponse({ isAuthenticated: !!user, user });
    });
    return true;
  }

  // One-Login Sync from website (via content.js)
  if (request.action === ACTIONS.SYNC_AUTH) {
    if (request.token) {
      const user = jwt.decodeJWT(request.token);
      storage.setAuthData({
        token: request.token,
        accessToken: request.token,
        refreshToken: request.refreshToken,
        user
      }).then(() => {
        console.log('[Momentum] Auth synced from website');
        sendResponse({ success: true, user });
      });
    } else {
      // Logout sync
      storage.clearAuthData().then(() => {
        console.log('[Momentum] Auth cleared (sync from website)');
        sendResponse({ success: true });
      });
    }
    return true;
  }

  // Logout request
  if (request.action === ACTIONS.LOGOUT) {
    storage.clearAuthData().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Activity pipeline
  if (request.type === ACTIONS.PROBLEM_SOLVED) {
    self.MomentumLogger.info('PROBLEM_SOLVED received:', request.data.problemTitle);

    self.ActivityManager.handleActivity(request.data)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((err) => {
        self.MomentumLogger.error('Activity handling failed:', err.message);
        sendResponse({ success: false });
      });

    return true; // keep message channel open for async response
  }
  
  // Flush queue
  if (request.type === ACTIONS.FLUSH_QUEUE) {
    self.MomentumLogger.info('FLUSH_QUEUE received from content script');
    self.ActivityManager.flushQueue();
    sendResponse({ success: true });
    return false; // synchronous response
  }
});

// ═══════════════════════════════════════════════════════════════════════
// QUEUE FLUSH — On startup + periodic alarm + network online
// ═══════════════════════════════════════════════════════════════════════

// Flush on network online event (if SW is awake)
self.addEventListener('online', () => {
  self.MomentumLogger.info('Service worker detected online event — flushing queue');
  self.ActivityManager.flushQueue();
});

// Flush on service worker startup
self.ActivityManager.flushQueue();

// Periodic flush
chrome.alarms.create(config.ALARM_NAMES.FLUSH_QUEUE, {
  periodInMinutes: config.TIMING.FLUSH_INTERVAL_MINUTES
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === config.ALARM_NAMES.FLUSH_QUEUE) {
    self.MomentumLogger.debug('Alarm triggered — flushing queue');
    self.ActivityManager.flushQueue();
  }
});
