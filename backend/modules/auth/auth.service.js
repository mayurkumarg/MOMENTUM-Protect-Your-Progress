const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const AppError = require('../../utils/AppError');
const User = require('../user/user.model');
const userService = require('../user/user.service');
const githubService = require('./github.service');
const githubIntegrationService = require('../github/github.service');

const signAccessToken = (userId) =>
  jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );

const signRefreshToken = (userId) => {
  const token = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  return token;
};

// Signed separately from the outer state JSON (which is otherwise unsigned)
// so a caller can't forge `linkUserId` and attach their GitHub token to
// someone else's Momentum account.
const signGithubLinkToken = (userId) =>
  jwt.sign({ userId, purpose: 'github-link' }, process.env.JWT_SECRET, { expiresIn: '10m' });

const verifyGithubLinkToken = (linkToken) => {
  try {
    const decoded = jwt.verify(linkToken, process.env.JWT_SECRET);
    return decoded.purpose === 'github-link' ? decoded.userId : null;
  } catch {
    return null;
  }
};

const parseOAuthState = (state) => {
  if (!state) return { source: 'extension', returnTo: '', linkUserId: null };

  try {
    const parsed = JSON.parse(state);
    return {
      source: parsed.source === 'web' ? 'web' : 'extension',
      returnTo: typeof parsed.returnTo === 'string' ? parsed.returnTo : '',
      linkUserId: parsed.linkToken ? verifyGithubLinkToken(parsed.linkToken) : null,
    };
  } catch {
    return { source: state === 'web' ? 'web' : 'extension', returnTo: '', linkUserId: null };
  }
};

// Register with email + password
const registerUser = async (email, username, password) => {
  // Check if email already exists
  const existingEmail = await userService.findByEmail(email);
  if (existingEmail) {
    throw new AppError('Email already registered', 409);
  }

  // Check if username already exists
  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    throw new AppError('Username already taken', 409);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const user = await userService.createEmailUser(email, username, passwordHash);

  return userService.serializeUser(user);
};

// Login with email + password
const loginUser = async (email, password) => {
  // Find user by email with password field
  const user = await userService.findByEmail(email);
  if (!user || user.authProvider !== 'email') {
    throw new AppError('Invalid email or password', 401);
  }

  const userWithPassword = await userService.findByIdWithPassword(user._id);

  // Compare password
  const isPasswordValid = await bcrypt.compare(password, userWithPassword.password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Generate tokens
  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = signRefreshToken(user._id.toString());
  const refreshTokenExpiresAt = new Date();
  refreshTokenExpiresAt.setDate(
    refreshTokenExpiresAt.getDate() + 30
  );

  await userService.addRefreshToken(user._id, refreshToken, refreshTokenExpiresAt);

  return {
    token: accessToken,
    refreshToken,
    user: userService.serializeUser(user),
  };
};

// GitHub login (OAuth). When `linkUserId` is set, this is an already
// logged-in Momentum user (e.g. an email account) granting repo access from
// Settings — not a login — so it must reuse their existing session rather
// than finding/creating a different user or issuing new tokens.
const githubLogin = async (code, linkUserId = null) => {
  try {
    // Exchange code for access token
    const githubAccessToken = await githubService.exchangeCodeForToken(code);

    // Fetch GitHub user data
    const githubUser = await githubService.getGithubUser(githubAccessToken);

    if (linkUserId) {
      const currentUser = await User.findById(linkUserId);
      if (!currentUser) {
        throw new AppError('Your session could not be found. Please sign in again.', 401);
      }

      const owner = await User.findOne({ githubId: githubUser.id });
      if (owner && String(owner._id) !== String(currentUser._id)) {
        throw new AppError('This GitHub account is already linked to a different Momentum account.', 409);
      }

      if (!currentUser.githubId) {
        currentUser.githubId = githubUser.id;
        if (!currentUser.avatar) currentUser.avatar = githubUser.avatar_url;
        await currentUser.save();
      }

      await githubIntegrationService.upsertIntegrationToken(currentUser._id, {
        accessToken: githubAccessToken,
        scope: 'repo',
        githubUser,
      });

      return { linked: true, user: userService.serializeUser(currentUser) };
    }

    // Find or create user
    let user = await User.findOne({ githubId: githubUser.id });

    if (!user) {
      user = new User({
        githubId: githubUser.id,
        username: githubUser.login,
        avatar: githubUser.avatar_url,
        email: githubUser.email,
        authProvider: 'github',
        isEmailVerified: true,
      });
      await user.save();
    }

    // Generate tokens
    const accessToken = signAccessToken(user._id.toString());
    const refreshToken = signRefreshToken(user._id.toString());
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(
      refreshTokenExpiresAt.getDate() + 30
    );

    await userService.addRefreshToken(user._id, refreshToken, refreshTokenExpiresAt);

    return {
      token: accessToken,
      refreshToken,
      user: userService.serializeUser(user),
    };
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    throw new AppError('GitHub login failed', 500);
  }
};

// Refresh access token
const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }

    // Find user with this refresh token
    const user = await userService.findUserByRefreshToken(refreshToken);
    if (!user) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    // Generate new access token
    const newAccessToken = signAccessToken(user._id.toString());

    return {
      token: newAccessToken,
      refreshToken,
    };
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AppError('Invalid or expired refresh token', 401);
    }
    if (error.isOperational) {
      throw error;
    }
    throw new AppError('Token refresh failed', 500);
  }
};

// Logout (invalidate refresh tokens)
const logoutUser = async (userId) => {
  await userService.removeAllRefreshTokens(userId);
};

// Get authenticated user
const getAuthenticatedUser = async (userId) => {
  const user = await userService.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return userService.serializeUser(user);
};

module.exports = {
  registerUser,
  loginUser,
  githubLogin,
  refreshAccessToken,
  logoutUser,
  getAuthenticatedUser,
  parseOAuthState,
  signGithubLinkToken,
  signAccessToken,
  signRefreshToken,
};
