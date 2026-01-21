// backend/src/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard'); // Standardized on roleGuard
const { getAnalytics } = require('../controllers/reportController');

// GET /api/reports/analytics
// Restricted to Admin & Finance teams
router.get(
  '/analytics', 
  protect, 
  roleGuard('admin', 'finance'), 
  getAnalytics
);

module.exports = router;
