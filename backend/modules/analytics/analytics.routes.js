const express = require('express');
const analyticsController = require('./analytics.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/summary', analyticsController.getAnalyticsSummary);

module.exports = router;
