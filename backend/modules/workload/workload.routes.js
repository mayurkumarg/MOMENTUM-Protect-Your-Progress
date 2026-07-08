const express = require('express');
const workloadController = require('./workload.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/summary', workloadController.getWorkloadSummary);

module.exports = router;
