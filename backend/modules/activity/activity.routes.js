const express = require('express');
const activityController = require('./activity.controller');
const authMiddleware = require('../../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/', activityController.createActivity);
router.get('/', activityController.getActivities);
router.get('/:id', activityController.getActivityById);
router.patch('/:id', activityController.updateActivity);
router.delete('/:id', activityController.deleteActivity);

module.exports = router;
