const axios = require('axios');
const AppError = require('../../utils/AppError');

const exchangeCodeForToken = async (code) => {
  try {
    const response = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (response.data.error || !response.data.access_token) {
      throw new AppError('Failed to exchange code for token', 401);
    }

    return response.data.access_token;
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
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
