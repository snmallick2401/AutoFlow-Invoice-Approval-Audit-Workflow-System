// backend/src/controllers/invoiceController.js
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const Invoice = require('../models/Invoice');
const { generateInvoiceId } = require('../utils/invoiceIdGenerator');
const emailService = require('../utils/emailService');
const { logAction } = require('../utils/auditLogger');
const { processAction } = require('../utils/workflowEngine');

// Configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads', 'invoices');
const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || '5242880', 10); // 5MB
const MAX_RETRIES = 3;

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/* -------------------- Multer Configuration -------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Temp name to avoid collisions before ID generation
    const tmpName = `temp-${Date.now()}-${Math.floor(Math.random() * 1e6)}.pdf`;
    cb(null, tmpName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are allowed'), false);
  }
  if (path.extname(file.originalname).toLowerCase() !== '.pdf') {
    return cb(new Error('File must have .pdf extension'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

// Promisified upload wrapper
const uploadSingle = (req, res) =>
  new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

/* -------------------- POST /api/invoice/create -------------------- */
const createInvoice = async (req, res) => {
  let currentFilePath = null;

  try {
    await uploadSingle(req, res);

    if (!req.file) {
      return res.status(400).json({ message: 'Invoice PDF file is required' });
    }
    currentFilePath = req.file.path;

    const { vendorName, amount, invoiceDate } = req.body;

    // 1. Validation
    if (!vendorName || !amount || !invoiceDate) {
      throw new Error('Missing required fields');
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Amount must be a positive number');
    }

    const parsedDate = new Date(invoiceDate);
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Invalid invoiceDate');
    }

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let lastError = null;

    // 2. ID Generation Loop
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const invoiceId = await generateInvoiceId();
        const finalName = `${invoiceId}.pdf`;
        const finalPath = path.join(UPLOAD_DIR, finalName);

        // Rename temp file to final ID
        fs.renameSync(currentFilePath, finalPath);
        currentFilePath = finalPath;

        // Relative path for DB/Frontend
        const relativePath = path
          .relative(path.join(__dirname, '..', '..'), finalPath)
          .split(path.sep).join('/');

        const invoice = new Invoice({
          invoiceId,
          vendorName: vendorName.trim(),
          amount: parsedAmount,
          invoiceDate: parsedDate,
          status: 'PENDING',
          submittedBy: req.user._id,
          currentApprover: null,
          filePath: relativePath,
        });

        const saved = await invoice.save();

        // 3. Post-Process (Async)
        emailService.sendInvoiceSubmittedEmail({
          invoice: saved,
          to: process.env.NOTIFICATION_EMAIL,
          actor: { name: req.user.name, role: req.user.role },
        }).catch(console.error);

        logAction({
          req,
          action: 'INVOICE_SUBMITTED',
          user: { id: req.user._id, role: req.user.role },
          resource: { type: 'Invoice', id: saved.invoiceId },
          metadata: { amount: parsedAmount, vendorName },
        });

        return res.status(201).json({ invoice: saved });

      } catch (err) {
        lastError = err;
        if (err.code === 11000) continue; // Retry if ID exists
        break;
      }
    }
    throw lastError || new Error('Failed to create invoice');

  } catch (err) {
    // Cleanup file on failure
    if (currentFilePath && fs.existsSync(currentFilePath)) {
      try { fs.unlinkSync(currentFilePath); } catch (e) {}
    }
    console.error('Invoice creation error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
};

/* -------------------- GET /api/invoice/my -------------------- */
const getMyInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ submittedBy: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ invoices });
  } catch (err) {
    console.error('getMyInvoices error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/* -------------------- GET /api/invoice (Approvals & Reports) -------------------- */
const getInvoices = async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    const { role } = req.user;
    const filter = {};

    // 1. Status Filter with Role-Based Scoping
    if (status && status !== 'all') {
      filter.status = status.toUpperCase();

      // Smart Stage Filtering for 'PENDING'
      if (filter.status === 'PENDING') {
        if (role === 'manager') {
          // Managers only see items with NO approvals yet
          filter.approvalHistory = { $size: 0 };
        } else if (role === 'finance') {
          // Finance only sees items that have passed Manager (History > 0)
          filter.approvalHistory = { $not: { $size: 0 } };
        }
        // Admins see all pending
      }
    }

    // 2. Date Filter
    if (startDate) {
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date(startDate); // Default to single day if no end
      
      // Ensure end date covers the full day
      end.setHours(23, 59, 59, 999);
      
      // Handle valid dates only
      if (!isNaN(start.getTime())) {
        filter.invoiceDate = { $gte: start, $lte: end };
      }
    }

    const invoices = await Invoice.find(filter)
      .populate('submittedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ invoices });
  } catch (err) {
    console.error('getInvoices error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/* -------------------- PUT /api/invoice/:id/status (Approve/Reject) -------------------- */
const updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    // Support both ID formats (INV-xxx and MongoDB ObjectId)
    let invoice = await Invoice.findOne({ invoiceId: id });
    if (!invoice && id.match(/^[0-9a-fA-F]{24}$/)) {
      invoice = await Invoice.findById(id);
    }

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const action = status === 'APPROVED' ? 'APPROVE' : 'REJECT';

    // Business Logic via Workflow Engine
    processAction({
      invoice,
      user: { id: req.user._id, role: req.user.role },
      action,
      comment: reason
    });

    if (status === 'REJECTED' && reason) {
      invoice.rejectionReason = reason;
    }

    const saved = await invoice.save();

    // Async Notifications
    if (status === 'APPROVED') {
      emailService.sendInvoiceApprovedEmail({
        invoice: saved,
        to: process.env.NOTIFICATION_EMAIL,
        actor: { name: req.user.name, role: req.user.role }
      }).catch(console.error);
    } else {
      emailService.sendInvoiceRejectedEmail({
        invoice: saved,
        to: process.env.NOTIFICATION_EMAIL,
        actor: { name: req.user.name, role: req.user.role },
        reason
      }).catch(console.error);
    }

    logAction({
      req,
      action: status === 'APPROVED' ? 'INVOICE_APPROVED' : 'INVOICE_REJECTED',
      user: { id: req.user._id, role: req.user.role },
      resource: { type: 'Invoice', id: saved.invoiceId },
      metadata: { finalStatus: saved.status, reason }
    });

    return res.status(200).json({ invoice: saved });

  } catch (err) {
    console.error('updateInvoiceStatus error:', err.message);
    return res.status(400).json({ message: err.message || 'Update failed' });
  }
};

module.exports = {
  createInvoice,
  getMyInvoices,
  getInvoices,
  updateInvoiceStatus
};
