/**
 * GeeksForGeeks Platform Adapter
 * Detects accepted submissions and extracts problem data.
 */
(function () {
  if (!self.__MomentumPlatforms) self.__MomentumPlatforms = {};

  self.__MomentumPlatforms.gfg = {
    name: 'GFG',
    hostMatch: 'geeksforgeeks',

    detectSolve() {
      const correctText = Array.from(document.querySelectorAll('body *')).some((el) => {
        try {
          return el.innerText && /\bCorrect\b|\bAccepted\b|\bRight Answer\b/i.test(el.innerText);
        } catch (e) {
          return false;
        }
      });

      if (correctText) return true;

      const possible = document.querySelector('.result-status, .status, .success, .accepted');
      return !!possible;
    },

    extractProblemData() {
      return {
        platform: 'GFG',
        problemTitle: document.title || '',
        url: window.location.href,
        solvedAt: new Date().toISOString(),
      };
    },
  };
})();
