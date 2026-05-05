const authService = require('./auth.service');

const sendSuccess = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

const getGithubOAuthUrl = (req, res, next) => {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    const scope = 'user:email';

    // Support optional source query (e.g., ?source=extension)
    const source = req.query.source;

    // Include state when initiated by extension so callback can detect it
    const state = source === 'extension' ? 'extension' : undefined;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
    });

    if (state) params.set('state', state);

    const githubOAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    return res.redirect(githubOAuthUrl);
  } catch (error) {
    next(error);
  }
};

const githubCallback = async (req, res, next) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code not provided',
      });
    }

    const result = await authService.githubLogin(code);

    const extensionId = process.env.EXTENSION_ID;

    // Always redirect to extension chromiumapp URL with token
    const extensionRedirect = `https://${extensionId}.chromiumapp.org/?token=${result.token}`;
    return res.redirect(extensionRedirect);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getGithubOAuthUrl,
  githubCallback,
};