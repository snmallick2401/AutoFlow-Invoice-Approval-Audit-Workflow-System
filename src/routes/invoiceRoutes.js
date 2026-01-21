// backend/src/routes/invoiceRoutes.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const roleGuard = require('../middleware/roleGuard');

// Import logic from invoiceController
const {
  createInvoice,
  getMyInvoices,
  getInvoices,
  updateInvoiceStatus
} = require('../controllers/invoiceController');

/* =================================================
   ROUTES
================================================= */

// 1. Submit Invoice (Authenticated Users)
// POST /api/invoice/create
router.post('/create', protect, createInvoice);

// 2. My Invoices (Authenticated Users)
// GET /api/invoice/my
router.get('/my', protect, getMyInvoices);

// 3. Search/Filter Invoices (Managers/Finance/Admin)
// GET /api/invoice?status=pending
router.get('/', protect, roleGuard('manager', 'finance', 'admin'), getInvoices);

// 4. Update Status (Approve/Reject)
// PUT /api/invoice/:id/status
router.put('/:id/status', protect, roleGuard('manager', 'finance', 'admin'), updateInvoiceStatus);

module.exports = router;
