const authService = require('./auth.service');
const userService = require('../user/user.service');
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
  const clientUrl = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

  try {
    const { code, state } = req.query;

    if (!code) {
      console.error(`[AUTH] No authorization code provided`);
      const errorUrl = `${clientUrl}/auth/login?error=${encodeURIComponent('Authorization code not provided')}`;
      return res.redirect(errorUrl);
    }

    const parsedState = authService.parseOAuthState(state);
    const result = await authService.githubLogin(code, parsedState.linkUserId);

    if (parsedState.source === 'web') {
      const callbackPath = parsedState.returnTo || '/overview';
      const joinParam = callbackPath.includes('?') ? '&' : '?';

      // Linking repo access to an already-logged-in account — the user
      // already has a valid Momentum session, so don't touch it or issue
      // new tokens, just bounce back with a success flag.
      if (result.linked) {
        const redirectUrl = `${clientUrl}${callbackPath}${joinParam}github=connected`;
        console.log('[AUTH] GitHub repo access linked, redirecting to app');
        return res.redirect(redirectUrl);
      }

      // Never log the redirect URL itself — it carries the access and refresh
      // tokens as query params.
      const tokenParams = `token=${encodeRedirectParam(result.token)}&refreshToken=${encodeRedirectParam(result.refreshToken)}`;
      const redirectUrl = `${clientUrl}${callbackPath}${joinParam}${tokenParams}`;
      console.log('[AUTH] OAuth login success (web), redirecting to app');
      return res.redirect(redirectUrl);
    }

    const extensionId = process.env.EXTENSION_ID;
    if (!extensionId) {
      console.error(`[AUTH] Extension ID not configured`);
      const errorUrl = `${clientUrl}/auth/login?error=${encodeURIComponent('Extension OAuth is not configured')}`;
      return res.redirect(errorUrl);
    }

    const tokenParams = `token=${encodeRedirectParam(result.token)}&refreshToken=${encodeRedirectParam(result.refreshToken)}`;
    const extensionRedirect = `https://${extensionId}.chromiumapp.org/?${tokenParams}`;
    // Never log the redirect URL — it carries the access and refresh tokens.
    console.log('[AUTH] OAuth login success (extension), redirecting');
    return res.redirect(extensionRedirect);
  } catch (error) {
    console.error(`[AUTH] Callback error: ${error.message}`);

    // A linking attempt (already logged in) should bounce back to Settings
    // with an inline error instead of booting the user to the login page.
    let parsedState = { source: 'extension', returnTo: '', linkUserId: null };
    try {
      parsedState = authService.parseOAuthState(req.query.state);
    } catch {
      // fall through to the default login-error redirect below
    }

    const errorMessage = error.message || 'GitHub login failed';

    if (parsedState.linkUserId) {
      const errorUrl = `${clientUrl}/settings?github=error&message=${encodeURIComponent(errorMessage)}`;
      console.log(`[AUTH] Redirecting to settings with error: ${errorUrl}`);
      return res.redirect(errorUrl);
    }

    const errorUrl = `${clientUrl}/auth/login?error=${encodeURIComponent(errorMessage)}`;
    console.log(`[AUTH] Redirecting to login with error: ${errorUrl}`);
    return res.redirect(errorUrl);
  }
};

// Only a relative in-app path — never let a caller-supplied returnTo redirect
// off Momentum after GitHub auth completes.
const SAFE_RETURN_TO = /^\/[a-zA-Z0-9\-_/]*$/;

// Returns a GitHub authorize URL requesting repo scope, for an ALREADY
// logged-in user connecting repo sync from wherever they are in the app (not
// just Settings). Reuses the exact same OAuth app + callback URL as the login
// flow above — the signed linkToken in `state` is what tells the shared
// callback this is a link, not a login, and `returnTo` is what sends the user
// back to the page they started from instead of always landing on Settings.
const getGithubConnectUrl = (req, res, next) => {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return res.status(500).json({ success: false, message: 'GitHub OAuth is not configured.' });
    }

    const requestedReturnTo = typeof req.query.returnTo === 'string' ? req.query.returnTo : '';
    const returnTo = SAFE_RETURN_TO.test(requestedReturnTo) ? requestedReturnTo : '/settings';

    const linkToken = authService.signGithubLinkToken(req.user.userId);
    const state = JSON.stringify({ source: 'web', returnTo, linkToken });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo',
      state,
    });

    return res.status(200).json({
      success: true,
      data: { url: `https://github.com/login/oauth/authorize?${params.toString()}` },
    });
  } catch (error) {
    next(error);
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

// Update notification/reminder preferences
const updatePreferences = async (req, res, next) => {
  try {
    const { reminderChannel } = req.body;
    const user = await userService.updateNotificationPreferences(req.user.userId, reminderChannel);
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
  getGithubConnectUrl,
  githubCallback,
  me,
  updatePreferences,
  refresh,
};
