/**
 * Momentum Structured Logger
 * Prefixes all logs with [Momentum] for easy filtering in DevTools.
 */
(function () {
  const PREFIX = '[Momentum]';

  self.MomentumLogger = {
    info: (...args) => console.log(PREFIX, ...args),
    warn: (...args) => console.warn(PREFIX, ...args),
    error: (...args) => console.error(PREFIX, ...args),
    debug: (...args) => console.debug(PREFIX, ...args),
  };
})();
