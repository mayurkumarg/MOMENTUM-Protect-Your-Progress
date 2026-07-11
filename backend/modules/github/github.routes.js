const express = require('express');
const githubController = require('./github.controller');
const authMiddleware = require('../../middlewares/authMiddleware');
const { githubWriteLimiter } = require('../../middlewares/rateLimiters');

const router = express.Router();

// GitHub OAuth (connect-url + callback) lives in the auth module — this
// module only manages the repo once a token already exists (see auth.routes.js
// for GET /api/auth/github/connect-url and GET /api/auth/github/callback).
router.get('/status', authMiddleware, githubController.getStatus);
router.get('/repos', authMiddleware, githubController.listRepos);
router.post('/repos', authMiddleware, githubWriteLimiter, githubController.createRepo);
router.post('/repo/select', authMiddleware, githubWriteLimiter, githubController.connectRepo);
router.delete('/disconnect', authMiddleware, githubController.disconnect);

router.get('/activity', authMiddleware, githubController.getActivityDashboard);
router.post('/activity/:activityId/retry', authMiddleware, githubController.retrySync);

module.exports = router;
