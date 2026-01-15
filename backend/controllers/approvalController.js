// backend/src/controllers/approvalController.js
/**
 * Approval Controller — AutoFlow
 * =================================================
 * Responsibilities:
 * - Approve / reject invoices via workflow engine
 * - Enforce authentication + RBAC (via middleware)
 * - Persist approval history and status changes
 * - Trigger non-blocking email notifications (Phase 5)
 * - Emit immutable audit logs for compliance (Phase 6)
 * - Expose pending invoices per role
 *
 * ===================== SELF-AUDIT =====================
 *
 * LOGIC
 * - Workflow rules live ONLY in workflowEngine
 * - Controller orchestrates: fetch → validate → process → save
 *
 * SECURITY
 * - Requires authenticated user (protect middleware)
 * - Role filtering enforced by roleGuard + workflowEngine
 * - Never trusts client input for workflow state
 *
 * DATA INTEGRITY
 * - Approval history is append-only
 * - Finalized invoices cannot be mutated
 *
 * EMAIL (PHASE 5)
 * - Email triggered ONLY after successful DB save
 * - Email failures NEVER affect API response
 * - Fire-and-forget, fault-tolerant side effect
 *
 * AUDIT (PHASE 6)
 * - Every approve / reject action is logged immutably
 * - Audit logging is non-blocking and never breaks approval flow
 *
 * FAILURE MODES
 * - 401 → unauthenticated
 * - 404 → invoice not found
 * - 400 → invalid workflow action
 * - 500 → unexpected server error
 */

const Invoice = require('../models/Invoice');
const { processAction, getExpectedRole } = require('../utils/workflowEngine');
const emailService = require('../utils/emailService');
const { logAction } = require('../utils/auditLogger');

// --------------------------------------------------
// PUT /api/invoice/approve/:id
// --------------------------------------------------
const approveInvoice = async (req, res) => {
  try {
    if (!req.user || !req.user._id || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Apply workflow logic
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

    /* -------- Phase 5: Email (NON-BLOCKING) -------- */
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

    /* -------- Phase 6: Audit Log (NON-BLOCKING) -------- */
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

// --------------------------------------------------
// PUT /api/invoice/reject/:id
// --------------------------------------------------
const rejectInvoice = async (req, res) => {
  try {
    if (!req.user || !req.user._id || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Apply workflow logic
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

    /* -------- Phase 5: Email (NON-BLOCKING) -------- */
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

    /* -------- Phase 6: Audit Log (NON-BLOCKING) -------- */
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

// --------------------------------------------------
// GET /api/invoice/pending
// --------------------------------------------------
const getPendingInvoices = async (req, res) => {
  try {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Employees never approve invoices
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
