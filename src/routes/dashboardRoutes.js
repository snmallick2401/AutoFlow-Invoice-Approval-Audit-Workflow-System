// backend/src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// IMPORT MUST MATCH CONTROLLER EXPORT EXACTLY
const { getDashboardSummary } = require('../controllers/dashboardController');

// GET /api/dashboard/summary
// Logic: Fetch KPIs (Total, Pending, Approved, Rejected)
router.get('/summary', protect, getDashboardSummary);

module.exports = router;
