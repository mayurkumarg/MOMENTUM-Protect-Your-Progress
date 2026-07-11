const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Missing or invalid authorization header', 401);
    }

    const token = authHeader.slice(7);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'refresh') {
      throw new AppError('Cannot use refresh token as access token', 401);
    }

    req.user = {
      userId: decoded.userId,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired token', 401));
    }

    next(error);
  }
};

module.exports = authMiddleware;
