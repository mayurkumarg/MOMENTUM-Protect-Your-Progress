const axios = require('axios');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

const exchangeCodeForToken = async (code) => {
  try {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (response.data.error) {
      throw new AppError('Failed to exchange code for token', 401);
    }

    return response.data.access_token;
  } catch (error) {
    throw new AppError('GitHub authentication failed', 401);
  }
};

const getGithubUser = async (token) => {
  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    return response.data;
  } catch (error) {
    throw new AppError('Failed to fetch GitHub user', 401);
  }
};

module.exports = {
  exchangeCodeForToken,
  getGithubUser,
};
