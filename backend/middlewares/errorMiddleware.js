const errorMiddleware = (err, req, res, next) => {
  let statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  let message = err.message || 'Internal server error.';

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}.`;
  } else if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    message = `That ${field} is already in use.`;
  } else if (!err.isOperational && statusCode >= 500) {
    // Anything not deliberately thrown as an AppError is an unexpected
    // failure — never forward its raw message (may contain internal driver/
    // collection/index details) to the client.
    message = 'Internal server error.';
  }

  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorMiddleware;
