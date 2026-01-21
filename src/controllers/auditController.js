// backend/src/controllers/auditController.js
/**
 * Audit Controller — AutoFlow
 * =================================================
 * Responsibilities:
 * - Fetch and filter immutable audit logs
 * - Support pagination for large datasets
 * - Allow filtering by Date, Actor, Action, and Target Resource
 */

const AuditLog = require('../models/AuditLog');

exports.getAuditLogs = async (req, res) => {
  try {
    // 1. Parse & Validate Pagination
    // Default to page 1, limit 15. Cap max limit at 100 to protect server.
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));

    const { action, date, userId, role, resourceId, resourceType } = req.query;

    // 2. Build Query Object
    const query = {};

    // Filter by Action (e.g., 'INVOICE_APPROVED')
    if (action && action !== 'all') {
      query.action = action;
    }

    // Filter by Specific User ID (The "Actor")
    if (userId) {
      query.userId = userId;
    }

    // Filter by Role (e.g., 'admin' actions only)
    if (role) {
      query.role = role;
    }

    // Filter by Resource ID (e.g., Search logs for "INV-2026-001")
    if (resourceId) {
      query['resource.id'] = { $regex: resourceId, $options: 'i' }; // Partial match support
    }

    // Filter by Resource Type (e.g., 'Invoice', 'User', 'AuthAttempt')
    if (resourceType) {
      query['resource.type'] = resourceType;
    }

    // Filter by Date Range (Single Day)
    if (date) {
      const start = new Date(date);
      // Validate date to prevent invalid query errors
      if (!isNaN(start.getTime())) {
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        
        query.timestamp = {
          $gte: start,
          $lte: end
        };
      }
    }

    // 3. Pagination Logic
    const skip = (page - 1) * limit;

    // 4. Execute Query with Population
    // Populating 'userId' allows the frontend to show "User Name" instead of just ID
    const logs = await AuditLog.find(query)
      .populate('userId', 'name email role') 
      .sort({ timestamp: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean(); // .lean() for better performance since we don't need Mongoose documents

    // 5. Get Total Count (for Pagination UI)
    const total = await AuditLog.countDocuments(query);

    res.status(200).json({
      logs,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error("Audit Query Error:", error.message);
    res.status(500).json({ message: "Server error fetching audit logs" });
  }
};
