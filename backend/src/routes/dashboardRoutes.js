// backend/src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { getSummary } = require('../controllers/dashboardController');

// GET /api/dashboard/summary
router.get('/summary', protect, getSummary);

module.exports = router;
