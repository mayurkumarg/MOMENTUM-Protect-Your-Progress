const authService = require('./auth.service');
const { validateRegisterInput, validateLoginInput } = require('./auth.validation');

const encodeRedirectParam = (value) => encodeURIComponent(value);

const sendSuccess = (res, statusCode, data) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

// Register with email + password
const register = async (req, res, next) => {
  try {
    const { email, username, password, confirmPassword } = req.body;

    // Validate input
    const { isValid, errors } = validateRegisterInput({ email, password, confirmPassword, username });
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    const user = await authService.registerUser(email, username, password);

    return sendSuccess(res, 201, {
      message: 'Registration successful',
      user,
    });
  } catch (error) {
    next(error);
  }
};

// Login with email + password
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    const { isValid, errors } = validateLoginInput({ email, password });
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    const result = await authService.loginUser(email, password);

    return sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
};

// Logout
const logout = async (req, res, next) => {
  try {
    await authService.logoutUser(req.user.userId);

    return sendSuccess(res, 200, {
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get GitHub OAuth URL
const getGithubOAuthUrl = (req, res, next) => {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;
    const scope = 'user:email';
    const source = req.query.source === 'web' ? 'web' : 'extension';
    const returnTo = req.query.returnTo || '';

    console.log(`[AUTH] GitHub OAuth requested - source: ${source}, returnTo: ${returnTo}`);

    if (!clientId || !redirectUri) {
      return res.status(500).json({
        success: false,
        message: 'GitHub OAuth is not configured.',
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state: JSON.stringify({ source, returnTo }),
    });

    const githubOAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    return res.redirect(githubOAuthUrl);
  } catch (error) {
    next(error);
  }
};

// GitHub OAuth callback
const githubCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      console.error(`[AUTH] No authorization code provided`);
      const clientUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const errorUrl = `${clientUrl}/auth/login?error=${encodeURIComponent('Authorization code not provided')}`;
      return res.redirect(errorUrl);
    }

    const result = await authService.githubLogin(code);
    const parsedState = authService.parseOAuthState(state);
    const tokenParams = `token=${encodeRedirectParam(result.token)}&refreshToken=${encodeRedirectParam(result.refreshToken)}`;

    if (parsedState.source === 'web') {
      const clientUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const callbackPath = parsedState.returnTo || '/overview';

      let redirectUrl;
      if (callbackPath.includes('?')) {
        redirectUrl = `${clientUrl}${callbackPath}&${tokenParams}`;
      } else {
        redirectUrl = `${clientUrl}${callbackPath}?${tokenParams}`;
      }

      console.log(`[AUTH] Redirecting to web: ${redirectUrl}`);
      return res.redirect(redirectUrl);
    }

    const extensionId = process.env.EXTENSION_ID;
    if (!extensionId) {
      console.error(`[AUTH] Extension ID not configured`);
      const clientUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const errorUrl = `${clientUrl}/auth/login?error=${encodeURIComponent('Extension OAuth is not configured')}`;
      return res.redirect(errorUrl);
    }

    const extensionRedirect = `https://${extensionId}.chromiumapp.org/?${tokenParams}`;
    console.log(`[AUTH] Redirecting to extension: ${extensionRedirect}`);
    return res.redirect(extensionRedirect);
  } catch (error) {
    console.error(`[AUTH] Callback error: ${error.message}`);
    
    // Redirect to login with error instead of sending JSON
    const clientUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const errorMessage = error.message || 'GitHub login failed';
    const errorUrl = `${clientUrl}/auth/login?error=${encodeURIComponent(errorMessage)}`;
    
    console.log(`[AUTH] Redirecting to login with error: ${errorUrl}`);
    return res.redirect(errorUrl);
  }
};

// Get current user
const me = async (req, res, next) => {
  try {
    const user = await authService.getAuthenticatedUser(req.user.userId);
    return sendSuccess(res, 200, user);
  } catch (error) {
    next(error);
  }
};

// Refresh access token
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token not provided',
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    return sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getGithubOAuthUrl,
  githubCallback,
  me,
  refresh,
};
