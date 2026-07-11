/**
 * Momentum Extension — OAuth Module
 * Handles the GitHub OAuth flow via chrome.identity.launchWebAuthFlow.
 * Extracted from background.js for separation of concerns.
 * Exposed on self.__MomentumOAuth for use by the background service worker.
 *
 * Requires:
 *   config/constants.js  (self.__MomentumConfig)
 *   utils/jwt.js         (self.__MomentumJWT)
 *   storage/storage-service.js (self.__MomentumStorage)
 *   messaging/messaging-service.js (self.__MomentumMessaging)
 */
(function () {
  const config = self.__MomentumConfig;
  const jwt = self.__MomentumJWT;
  const storage = self.__MomentumStorage;
  const messaging = self.__MomentumMessaging;
  const ACTIONS = config.MESSAGE_ACTIONS;

  self.__MomentumOAuth = {
    performOAuth(sendResponse) {
      chrome.identity.launchWebAuthFlow(
        {
          url: config.API_ENDPOINTS.AUTH_GITHUB,
          interactive: true,
        },
        (responseUrl) => {
          if (chrome.runtime.lastError || !responseUrl) {
            const message =
              chrome.runtime.lastError?.message || 'Authorization did not complete.';
            console.error('OAuth launch failed:', message);
            messaging.notifyPopup({ action: ACTIONS.LOGIN_ERROR, message });
            sendResponse({ success: false, message });
            return;
          }

          try {
            const finalUrl = new URL(responseUrl);
            const token = finalUrl.searchParams.get('token');

            if (!token) {
              throw new Error('Invalid response from server');
            }

            const user = jwt.decodeJWT(token);

            storage.setAuthData({ token, accessToken: token, user }).then(() => {
              messaging.notifyPopup({ action: ACTIONS.LOGIN_SUCCESS, user });
              sendResponse({ success: true, user });
            });
          } catch (error) {
            const message = error.message || 'Authentication failed';
            console.error('OAuth response handling failed:', error);
            messaging.notifyPopup({ action: ACTIONS.LOGIN_ERROR, message });
            sendResponse({ success: false, message });
          }
        }
      );
    },
  };
})();
