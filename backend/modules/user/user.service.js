const User = require('./user.model');
const AppError = require('../../utils/AppError');

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

  user.refreshTokens.push({
    token,
    expiresAt,
  });

  await user.save();
};

const findUserByRefreshToken = async (token) => {
  const user = await User.findOne({
    'refreshTokens.token': token,
    'refreshTokens.expiresAt': { $gt: new Date() },
  });

  return user;
};

const removeRefreshToken = async (userId, token) => {
  return User.updateOne(
    { _id: userId },
    { $pull: { refreshTokens: { token } } }
  );
};

const removeAllRefreshTokens = async (userId) => {
  return User.updateOne(
    { _id: userId },
    { $set: { refreshTokens: [] } }
  );
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
