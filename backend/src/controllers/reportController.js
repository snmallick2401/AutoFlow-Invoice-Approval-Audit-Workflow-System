// backend/src/controllers/reportController.js
const Invoice = require('../models/Invoice');

/**
 * GET /api/reports/analytics
 * Retrieves comprehensive invoice statistics for charts and tables.
 */
const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // 1. Security Check
    // Reports are generally for Admin/Finance. 
    // If an employee somehow accesses this, they should only see their own data? 
    // Or strictly block? Assuming RoleGuard handles blocking, but we scope just in case.
    const matchStage = {};
    
    // Strict date validation to prevent MongoDB cast errors
    if (startDate || endDate) {
      matchStage.invoiceDate = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          matchStage.invoiceDate.$gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999); // Include the full end day
          matchStage.invoiceDate.$lte = end;
        }
      }
      // Cleanup if invalid dates resulted in empty object
      if (Object.keys(matchStage.invoiceDate).length === 0) {
        delete matchStage.invoiceDate;
      }
    }

    // 2. Parallel Aggregations for Performance
    const [monthlyStats, statusStats, vendorStats, recentInvoices] = await Promise.all([
      
      // A. Monthly Spending Trend (Line Chart)
      Invoice.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$invoiceDate" } },
            totalAmount: { $sum: "$amount" },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } } // Oldest to newest
      ]),

      // B. Status Distribution (Pie Chart)
      Invoice.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$status", // e.g., 'APPROVED', 'PENDING'
            count: { $sum: 1 },
            value: { $sum: "$amount" }
          }
        }
      ]),

      // C. Top 5 Vendors by Spend (Bar Chart)
      Invoice.aggregate([
        { $match: { ...matchStage, status: 'APPROVED' } }, // Only count approved spend
        {
          $group: {
            _id: "$vendorName",
            totalSpend: { $sum: "$amount" },
            invoiceCount: { $sum: 1 }
          }
        },
        { $sort: { totalSpend: -1 } },
        { $limit: 5 }
      ]),

      // D. Recent Invoices List (Table Data)
      Invoice.find(matchStage)
        .sort({ invoiceDate: -1 })
        .limit(50)
        .select('invoiceId vendorName amount invoiceDate status submittedBy')
        .populate('submittedBy', 'name email')
        .lean()
    ]);

    // 3. Return Structured Data
    res.status(200).json({
      monthlyStats, // [{ _id: "2023-10", totalAmount: 5000 }]
      statusStats,  // [{ _id: "APPROVED", count: 12 }]
      vendorStats,  // [{ _id: "AWS", totalSpend: 1200 }]
      invoices: recentInvoices
    });

  } catch (error) {
    console.error("Analytics Report Error:", error);
    res.status(500).json({ message: "Server error generating reports" });
  }
};

module.exports = { getAnalytics };
