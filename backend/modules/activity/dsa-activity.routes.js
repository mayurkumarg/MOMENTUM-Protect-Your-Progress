const express = require('express');
const dsaActivityController = require('./dsa-activity.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

// All DSA activity routes require authentication
router.use(authMiddleware);

/**
 * POST /api/dsa/activity
 *
 * Receives a problem-solved event from the browser extension and
 * stores it as a DSA activity in MongoDB.
 *
 * Body: { platform, problemTitle, url, solvedAt }
 */
router.post('/activity', dsaActivityController.createDsaActivity);

/**
 * GET /api/dsa/summary
 *
 * Today's DSA activity snapshot for the "Coding Summary" dashboard section.
 */
router.get('/summary', dsaActivityController.getDsaSummary);

module.exports = router;
