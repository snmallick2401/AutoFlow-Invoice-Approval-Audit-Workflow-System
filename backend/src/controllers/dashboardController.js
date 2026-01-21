// backend/src/controllers/dashboardController.js
const Invoice = require('../models/Invoice');

/**
 * GET /api/dashboard/summary
 * Returns KPI metrics with Role-Aware "Pending" logic
 * (Managers see fresh invoices, Finance sees those approved by Manager)
 */
const getDashboardSummary = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { role, _id } = req.user;

    // 1. Define Base Scope
    // Employees: Only their own docs
    // Approvers (Admin/Manager/Finance): All docs
    const baseMatch = role === 'employee' ? { submittedBy: _id } : {};

    // 2. Define "My Pending" Logic
    // This distinguishes between "Pending Manager" vs "Pending Finance"
    let pendingQuery = { status: 'PENDING' };

    if (role === 'employee') {
      // Employees see all their own pending items
      pendingQuery = { ...baseMatch, status: 'PENDING' };

    } else if (role === 'manager') {
      // Managers need to see invoices with 0 approvals (Fresh)
      // We check that the approvalHistory array is empty
      pendingQuery = { 
        status: 'PENDING', 
        approvalHistory: { $size: 0 } 
      };

    } else if (role === 'finance') {
      // Finance needs to see invoices that are PENDING but have history (passed Manager)
      // We check that approvalHistory is NOT empty
      pendingQuery = { 
        status: 'PENDING', 
        approvalHistory: { $not: { $size: 0 } } 
      };
    }
    // Admin keeps default: { status: 'PENDING' } (sees everything)

    // 3. Execute Queries in Parallel (Faster)
    const [total, pendingCount, rejected, approvedAgg] = await Promise.all([
      // A. Total Invoices (Scoped)
      Invoice.countDocuments(baseMatch),

      // B. "My" Pending Actions
      Invoice.countDocuments(pendingQuery),

      // C. Rejected Count (Scoped)
      Invoice.countDocuments({ ...baseMatch, status: 'REJECTED' }),

      // D. Approved Value (Scoped)
      Invoice.aggregate([
        { $match: { ...baseMatch, status: 'APPROVED' } },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
      ])
    ]);

    // 4. Send Response
    res.status(200).json({
      totalInvoices: total,
      pendingApprovals: pendingCount,
      rejectedCount: rejected,
      approvedAmount: approvedAgg[0]?.totalAmount || 0,
    });

  } catch (err) {
    console.error('Dashboard Error:', err);
    res.status(500).json({ message: 'Server error generating dashboard' });
  }
};

// Export must match the import in dashboardRoutes.js
module.exports = { getDashboardSummary };
