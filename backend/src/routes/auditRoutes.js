// backend/src/routes/auditRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');
const { getAuditLogs } = require('../controllers/auditController');

// GET /api/audit
// Protected: Only Admin can view logs
router.get(
  '/', 
  protect, 
  roleGuard('admin'), 
  getAuditLogs
);

module.exports = router;
