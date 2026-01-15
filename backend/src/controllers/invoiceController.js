// backend/src/controllers/invoiceController.js
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const Invoice = require('../models/Invoice');
const { generateInvoiceId } = require('../utils/invoiceIdGenerator');
const emailService = require('../utils/emailService');
const { logAction } = require('../utils/auditLogger');

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ||
  path.join(__dirname, '..', '..', 'uploads', 'invoices');

const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || '5242880', 10);
const MAX_RETRIES = 3;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const tmp = `temp-${Date.now()}-${Math.floor(Math.random() * 1e6)}.pdf`;
    cb(null, tmp);
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

const uploadSingle = (req, res) =>
  new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

const createInvoice = async (req, res) => {
  try {
    await uploadSingle(req, res);

    if (!req.file) {
      return res.status(400).json({ message: 'Invoice PDF file is required' });
    }

    const { vendorName, amount, invoiceDate } = req.body;

    if (!vendorName || !amount || !invoiceDate) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({
        message: 'vendorName, amount, and invoiceDate are required',
      });
    }

    const parsedAmount = Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({ message: 'amount must be non-negative' });
    }

    const parsedDate = new Date(invoiceDate);
    if (isNaN(parsedDate.getTime())) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({ message: 'invoiceDate must be valid' });
    }

    if (!req.user || !req.user._id) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(401).json({ message: 'Authentication required' });
    }

    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const invoiceId = await generateInvoiceId();

        const finalName = `${invoiceId}.pdf`;
        const finalPath = path.join(UPLOAD_DIR, finalName);

        // move temp file to final filename (server-controlled name)
        fs.renameSync(req.file.path, finalPath);

        const invoice = new Invoice({
          invoiceId,
          vendorName: vendorName.trim(),
          amount: parsedAmount,
          invoiceDate: parsedDate,
          status: 'PENDING',
          submittedBy: req.user._id,
          currentApprover: null,
          filePath: path
            .relative(path.join(__dirname, '..', '..'), finalPath)
            .replace(/\\/g, '/'),
        });

        const saved = await invoice.save();

        // Non-blocking email notification
        (async () => {
          try {
            await emailService.sendInvoiceSubmittedEmail({
              invoice: saved,
              to: process.env.NOTIFICATION_EMAIL,
              actor: {
                name: req.user.name || 'User',
                role: req.user.role,
              },
            });
          } catch (e) {
            console.error('Invoice submitted email failed:', e?.message || e);
          }
        })();

        // Non-blocking audit log
        try {
          logAction({
            req,
            action: 'INVOICE_SUBMITTED',
            user: { id: req.user._id, role: req.user.role },
            resource: { type: 'Invoice', id: saved.invoiceId },
            metadata: {
              amount: parsedAmount,
              vendorName: vendorName.trim(),
              filePath: saved.filePath,
            },
          });
        } catch (auditErr) {
          console.error('Audit log invocation error:', auditErr?.message || auditErr);
        }

        return res.status(201).json({ invoice: saved });
      } catch (err) {
        lastError = err;

        if (err?.code === 11000) {
          console.warn(`Duplicate invoiceId, retrying (${attempt})`);
          continue;
        }

        try {
          if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch (_) {}

        console.error('Invoice creation error:', err);
        return res.status(500).json({ message: 'Server error' });
      }
    }

    console.error('Invoice creation failed after retries:', lastError);
    return res.status(500).json({ message: 'Failed to create invoice' });
  } catch (err) {
    try {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } catch (_) {}
    console.error('Unexpected invoice creation error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getMyInvoices = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const invoices = await Invoice.find({
      submittedBy: req.user._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ invoices });
  } catch (err) {
    console.error('getMyInvoices error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createInvoice,
  getMyInvoices,
};
