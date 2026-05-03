const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  let message = err.message || 'Internal server error.';

  if (err.name === 'CastError') {
    message = `Invalid ${err.path}.`;
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorMiddleware;
