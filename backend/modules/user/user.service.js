const crypto = require('crypto');
const User = require('./user.model');
const RefreshToken = require('../auth/refreshToken.model');
const AppError = require('../../utils/AppError');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const serializeUser = (user) => ({
  id: user._id,
  username: user.username,
  avatar: user.avatar,
  email: user.email,
  githubId: user.githubId,
  authProvider: user.authProvider,
  isEmailVerified: user.isEmailVerified,
});

const findOrCreateGithubUser = async (githubId, githubUserData) => {
  let user = await User.findOne({ githubId });

  if (!user) {
    user = new User({
      githubId,
      username: githubUserData.login,
      avatar: githubUserData.avatar_url,
      email: githubUserData.email,
      authProvider: 'github',
      isEmailVerified: true,
    });
    await user.save();
  }

  return user;
};

const findByEmail = async (email) => {
  return User.findOne({ email: email.toLowerCase() });
};

const findById = async (userId) => {
  return User.findById(userId);
};

const findByIdWithPassword = async (userId) => {
  return User.findById(userId).select('+password');
};

const createEmailUser = async (email, username, passwordHash) => {
  const existingEmailUser = await findByEmail(email);
  if (existingEmailUser) {
    throw new AppError('Email already registered', 400);
  }

  const existingUsernameUser = await User.findOne({ username });
  if (existingUsernameUser) {
    throw new AppError('Username already taken', 400);
  }

  const user = new User({
    email: email.toLowerCase(),
    username,
    password: passwordHash,
    authProvider: 'email',
  });

  await user.save();
  return user;
};

const addRefreshToken = async (userId, token, expiresAt) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  await RefreshToken.create({ userId, tokenHash: hashToken(token), expiresAt });
};

const findUserByRefreshToken = async (token) => {
  const record = await RefreshToken.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!record) return null;

  return User.findById(record.userId);
};

const removeRefreshToken = async (userId, token) => {
  return RefreshToken.deleteOne({ userId, tokenHash: hashToken(token) });
};

const removeAllRefreshTokens = async (userId) => {
  return RefreshToken.deleteMany({ userId });
};

module.exports = {
  serializeUser,
  findOrCreateGithubUser,
  findByEmail,
  findById,
  findByIdWithPassword,
  createEmailUser,
  addRefreshToken,
  findUserByRefreshToken,
  removeRefreshToken,
  removeAllRefreshTokens,
};
