// backend/src/controllers/approvalController.js
const Invoice = require('../models/Invoice');
const { processAction, getExpectedRole } = require('../utils/workflowEngine');
const emailService = require('../utils/emailService');
const { logAction } = require('../utils/auditLogger');

const approveInvoice = async (req, res) => {
  try {
    if (!req.user || !req.user._id || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    processAction({
      invoice,
      user: {
        id: req.user._id,
        role: req.user.role,
      },
      action: 'APPROVE',
      comment: req.body?.comment,
    });

    const saved = await invoice.save();

    // Non-blocking email notification
    (async () => {
      try {
        await emailService.sendInvoiceApprovedEmail({
          invoice: saved,
          to: process.env.NOTIFICATION_EMAIL,
          actor: {
            name: req.user.name || 'User',
            role: req.user.role,
          },
        });
      } catch (emailErr) {
        console.error('Invoice approved email failed:', emailErr?.message || emailErr);
      }
    })();

    // Non-blocking audit log
    try {
      logAction({
        req,
        action: 'INVOICE_APPROVED',
        user: {
          id: req.user._id,
          role: req.user.role,
        },
        resource: {
          type: 'Invoice',
          id: saved.invoiceId,
        },
        metadata: {
          comment: req.body?.comment || null,
          finalStatus: saved.status,
        },
      });
    } catch (auditErr) {
      console.error('Audit log invocation error:', auditErr?.message || auditErr);
    }

    return res.status(200).json({ invoice: saved });
  } catch (err) {
    console.error('approveInvoice error:', err?.message || err);

    if (err instanceof Error) {
      return res.status(400).json({
        message: err.message || 'Invalid approval action',
      });
    }

    return res.status(500).json({ message: 'Server error' });
  }
};

const rejectInvoice = async (req, res) => {
  try {
    if (!req.user || !req.user._id || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    processAction({
      invoice,
      user: {
        id: req.user._id,
        role: req.user.role,
      },
      action: 'REJECT',
      comment: req.body?.comment,
    });

    const saved = await invoice.save();

    // Non-blocking email notification
    (async () => {
      try {
        await emailService.sendInvoiceRejectedEmail({
          invoice: saved,
          to: process.env.NOTIFICATION_EMAIL,
          actor: {
            name: req.user.name || 'User',
            role: req.user.role,
          },
          reason: req.body?.comment,
        });
      } catch (emailErr) {
        console.error('Invoice rejected email failed:', emailErr?.message || emailErr);
      }
    })();

    // Non-blocking audit log
    try {
      logAction({
        req,
        action: 'INVOICE_REJECTED',
        user: {
          id: req.user._id,
          role: req.user.role,
        },
        resource: {
          type: 'Invoice',
          id: saved.invoiceId,
        },
        metadata: {
          comment: req.body?.comment || null,
          finalStatus: saved.status,
        },
      });
    } catch (auditErr) {
      console.error('Audit log invocation error:', auditErr?.message || auditErr);
    }

    return res.status(200).json({ invoice: saved });
  } catch (err) {
    console.error('rejectInvoice error:', err?.message || err);

    if (err instanceof Error) {
      return res.status(400).json({
        message: err.message || 'Invalid rejection action',
      });
    }

    return res.status(500).json({ message: 'Server error' });
  }
};

const getPendingInvoices = async (req, res) => {
  try {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role === 'employee') {
      return res.status(200).json({ invoices: [] });
    }

    const invoices = await Invoice.find({ status: 'PENDING' })
      .sort({ createdAt: 1 })
      .lean();

    const filtered = invoices.filter(
      (invoice) => getExpectedRole(invoice) === req.user.role
    );

    return res.status(200).json({ invoices: filtered });
  } catch (err) {
    console.error('getPendingInvoices error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  approveInvoice,
  rejectInvoice,
  getPendingInvoices,
};
