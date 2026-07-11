const express = require('express');
const assistantController = require('./assistant.controller');
const authMiddleware = require('../../middlewares/authMiddleware');
const { assistantLimiter } = require('../../middlewares/rateLimiters');

const router = express.Router();

router.use(authMiddleware);

router.get('/status', assistantController.getStatus);
router.post('/chat', assistantLimiter, assistantController.chat);

module.exports = router;
