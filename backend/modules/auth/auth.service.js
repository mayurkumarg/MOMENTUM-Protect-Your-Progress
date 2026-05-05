const jwt = require('jsonwebtoken');
const User = require('../user/user.model');
const githubService = require('./github.service');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

const githubLogin = async (code) => {
  try {
    // Exchange code for access token
    const accessToken = await githubService.exchangeCodeForToken(code);

    // Fetch GitHub user data
    const githubUser = await githubService.getGithubUser(accessToken);

    // Check if user exists in DB
    let user = await User.findOne({ githubId: githubUser.id });

    if (!user) {
      // Create new user
      user = new User({
        githubId: githubUser.id,
        username: githubUser.login,
        avatar: githubUser.avatar_url,
        email: githubUser.email,
      });

      await user.save();
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      {
        userId: user._id.toString(),
        githubId: user.githubId,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token: jwtToken,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        githubId: user.githubId,
      },
    };
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    throw new AppError('GitHub login failed', 500);
  }
};

module.exports = {
  githubLogin,
};
