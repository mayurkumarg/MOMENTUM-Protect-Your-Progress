/**
 * Momentum Extension — Centralized Messaging Service
 * Wraps chrome.runtime message passing for popup ↔ background ↔ content script communication.
 * Exposed on self.__MomentumMessaging for use across all extension contexts.
 *
 * Requires: config/constants.js (self.__MomentumConfig)
 */
(function () {
  const ACTIONS = self.__MomentumConfig.MESSAGE_ACTIONS;

  self.__MomentumMessaging = {
    ACTIONS,

    /** Send a message to the background service worker */
    sendToBackground(message, callback) {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Momentum] sendToBackground failed:', chrome.runtime.lastError.message);
        }
        if (typeof callback === 'function') {
          callback(response);
        }
      });
    },

    /** Notify the popup (best-effort — popup may not be open) */
    notifyPopup(message) {
      chrome.runtime.sendMessage(message).catch(() => {
        console.log('Popup not open, message queued');
      });
    },

    /** Add a one-time message listener that auto-removes after handling */
    onceMessage(actionOrActions, handler, timeoutMs) {
      const actions = Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions];

      const listener = (request) => {
        if (actions.includes(request.action)) {
          handler(request);
          chrome.runtime.onMessage.removeListener(listener);
        }
      };

      chrome.runtime.onMessage.addListener(listener);

      if (timeoutMs) {
        setTimeout(() => {
          chrome.runtime.onMessage.removeListener(listener);
        }, timeoutMs);
      }

      return listener;
    },
  };
})();
