const express = require('express');
const authController = require('./auth.controller');

const router = express.Router();

router.get('/github', authController.getGithubOAuthUrl);
router.get('/github/callback', authController.githubCallback);

module.exports = router;
