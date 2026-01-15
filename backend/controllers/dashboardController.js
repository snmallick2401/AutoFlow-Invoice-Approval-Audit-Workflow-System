// backend/src/controllers/dashboardController.js
/**
 * Dashboard Controller — AutoFlow
 * --------------------------------
 * Responsibilities:
 * - Provide role-scoped operational metrics for the UI
 * - Use aggregation pipelines for efficiency where appropriate
 *
 * Exports:
 * - getSummary(req, res): GET /api/dashboard/summary
 *
 * ===================== SELF-AUDIT =====================
 *
 * LOGIC
 * - Role-based scoping:
 *   - employee → metrics limited to invoices submitted by the user
 *   - manager  → metrics cover all invoices (manager-stage pending)
 *   - finance  → metrics cover all invoices (finance-stage pending)
 *
 * SECURITY
 * - Requires authentication (req.user populated by protect middleware)
 * - No trust in client input for filtering or aggregation
 *
 * DATA INTEGRITY
 * - Uses server-side aggregation only
 * - Handles empty datasets safely (returns zeros)
 *
 * PERFORMANCE
 * - Uses indexed fields: status, submittedBy
 * - Aggregation pipelines minimized and scoped
 *
 * EDGE CASES
 * - No invoices → all metrics return 0
 * - Money precision uses Number (acceptable for demo; Decimal128 for production)
 */

const Invoice = require('../models/Invoice');

/**
 * GET /api/dashboard/summary
 */
const getSummary = async (req, res) => {
  try {
    // Authentication guard (defensive; normally handled by protect middleware)
    if (!req.user || !req.user._id || !req.user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const role = req.user.role;
    const userId = req.user._id; // already an ObjectId

    // --------------------------------
    // Base filter (role-scoped)
    // --------------------------------
    const baseMatch =
      role === 'employee' ? { submittedBy: userId } : {};

    // --------------------------------
    // 1) totalInvoices
    // --------------------------------
    const totalInvoices = await Invoice.countDocuments(baseMatch);

    // --------------------------------
    // 2) rejectedCount
    // --------------------------------
    const rejectedCount = await Invoice.countDocuments({
      ...baseMatch,
      status: 'REJECTED',
    });

    // --------------------------------
    // 3) approvedAmount (sum)
    // --------------------------------
    const approvedAgg = await Invoice.aggregate([
      { $match: { ...baseMatch, status: 'APPROVED' } },
      {
        $group: {
          _id: null,
          totalApproved: {
            $sum: { $ifNull: ['$amount', 0] },
          },
        },
      },
    ]);

    const approvedAmount =
      approvedAgg.length > 0 ? approvedAgg[0].totalApproved : 0;

    // --------------------------------
    // 4) pendingApprovals (role-specific)
    // --------------------------------
    let pendingApprovals = 0;

    if (role === 'employee') {
      // Employee: their own pending invoices
      pendingApprovals = await Invoice.countDocuments({
        ...baseMatch,
        status: 'PENDING',
      });
    } else if (role === 'manager') {
      // Manager-stage: PENDING + no approval history
      const agg = await Invoice.aggregate([
        { $match: { status: 'PENDING' } },
        {
          $addFields: {
            approvalCount: {
              $size: { $ifNull: ['$approvalHistory', []] },
            },
          },
        },
        { $match: { approvalCount: 0 } },
        { $count: 'count' },
      ]);

      pendingApprovals = agg.length > 0 ? agg[0].count : 0;
    } else if (role === 'finance') {
      // Finance-stage: PENDING + last approval role === 'manager'
      const agg = await Invoice.aggregate([
        { $match: { status: 'PENDING' } },
        {
          $addFields: {
            rolesArray: {
              $map: {
                input: { $ifNull: ['$approvalHistory', []] },
                as: 'h',
                in: '$$h.role',
              },
            },
          },
        },
        {
          $addFields: {
            lastRole: { $arrayElemAt: ['$rolesArray', -1] },
          },
        },
        { $match: { lastRole: 'manager' } },
        { $count: 'count' },
      ]);

      pendingApprovals = agg.length > 0 ? agg[0].count : 0;
    }

    // --------------------------------
    // Response
    // --------------------------------
    return res.status(200).json({
      totalInvoices,
      pendingApprovals,
      approvedAmount,
      rejectedCount,
    });
  } catch (err) {
    console.error('dashboard summary error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getSummary,
};