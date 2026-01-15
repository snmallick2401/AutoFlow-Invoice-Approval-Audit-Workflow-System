// backend/src/routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');

const {
  createInvoice,
  getMyInvoices,
} = require('../controllers/invoiceController');

const {
  approveInvoice,
  rejectInvoice,
  getPendingInvoices,
} = require('../controllers/approvalController');

// Invoice Submission
router.post('/create', protect, createInvoice);
router.get('/my', protect, getMyInvoices);

// Approval Workflow
router.get(
  '/pending',
  protect,
  roleGuard('manager', 'finance', 'admin'),
  getPendingInvoices
);

router.put(
  '/approve/:id',
  protect,
  roleGuard('manager', 'finance', 'admin'),
  approveInvoice
);

router.put(
  '/reject/:id',
  protect,
  roleGuard('manager', 'finance', 'admin'),
  rejectInvoice
);

module.exports = router;
