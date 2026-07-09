const express = require('express');
const authController = require('./auth.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// Auth Endpoints
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);

// GitHub OAuth
router.get('/github', authController.getGithubOAuthUrl);
router.get('/github/callback', authController.githubCallback);

// Repo-scope grant for an already-logged-in user (Settings → GitHub repository).
// Reuses the same OAuth app + callback above — see getGithubConnectUrl for why.
router.get('/github/connect-url', authMiddleware, authController.getGithubConnectUrl);

// Token Management
router.post('/refresh', authController.refresh);

// User
router.get('/me', authMiddleware, authController.me);

module.exports = router;
