/**
 * Momentum Extension — JWT Utilities
 * Extracted from background.js and oauth-handler.html to eliminate duplication.
 * Exposed on self.__MomentumJWT for use across all extension contexts.
 */
(function () {
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

  self.__MomentumJWT = {
    decodeBase64Url,
    decodeJWT,
  };
})();
