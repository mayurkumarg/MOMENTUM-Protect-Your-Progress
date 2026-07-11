/**
 * Momentum Structured Logger
 * Prefixes all logs with [Momentum] for easy filtering in DevTools.
 * Respects LOG_LEVEL from config/constants.js
 */
(function () {
  const PREFIX = '[Momentum]';
  const config = self.__MomentumConfig || { LOG_LEVEL: 3 };

  function formatArgs(args) {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return arg;
        }
      }
      return arg;
    });
  }

  self.MomentumLogger = {
    error: (...args) => {
      if (config.LOG_LEVEL >= 1) console.error(PREFIX, ...formatArgs(args));
    },
    warn: (...args) => {
      if (config.LOG_LEVEL >= 2) console.warn(PREFIX, ...formatArgs(args));
    },
    info: (...args) => {
      if (config.LOG_LEVEL >= 3) console.log(PREFIX, ...formatArgs(args));
    },
    debug: (...args) => {
      if (config.LOG_LEVEL >= 4) console.debug(PREFIX, ...formatArgs(args));
    },
  };
})();
