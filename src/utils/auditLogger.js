// backend/src/utils/auditLogger.js
/**
 * Audit Logger Utility — AutoFlow
 * ==============================
 * Centralized, non-blocking audit logging helper.
 *
 * Responsibilities:
 * - Provide a single API to record audit events
 * - Normalize data (user, role, ip, resource)
 * - Ensure audit logging NEVER breaks business logic
 *
 * ===================== SELF-AUDIT =====================
 *
 * LOGIC
 * - Fire-and-forget design: callers may await or ignore safely
 * - Robust handling for anonymous/system actions (no user)
 *
 * SECURITY
 * - Never trusts client input directly
 * - User identity must come from authenticated context (req.user)
 * - IP captured from server-side request object
 */

const AuditLog = require('../models/AuditLog');

/**
 * Extract IP address safely from Express request
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractIp(req) {
  if (!req) return null;

  // x-forwarded-for may contain multiple IPs (client, proxy1, proxy2...)
  const xfwd = req.headers && req.headers['x-forwarded-for'];
  if (xfwd && typeof xfwd === 'string') {
    return xfwd.split(',')[0].trim();
  }

  return req.ip || req.connection?.remoteAddress || null;
}

/**
 * Core audit log writer (non-blocking)
 * @param {Object} params
 * @param {import('express').Request} [params.req] - Optional request object for IP extraction
 * @param {string} params.action - The event action code (e.g. 'INVOICE_SUBMITTED')
 * @param {Object} [params.user] - The actor ({ id, role }). Null if anonymous.
 * @param {Object} params.resource - Affected entity ({ type, id })
 * @param {Object} [params.metadata] - Additional context
 */
async function logAction({ req, action, user, resource, metadata }) {
  try {
    // 1. Strict Validation for Critical Fields
    // We allow 'user' to be null (for failed logins or system tasks), 
    // but action and resource are mandatory.
    if (!action || !resource || !resource.type || !resource.id) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ AuditLogger: Dropped log due to missing fields', { action, resource });
      }
      return; 
    }

    // 2. Normalize Actor Data
    // If no user is provided, treat as anonymous/system
    const userId = user?.id || null;
    const userRole = user?.role || (userId ? 'unknown' : 'anonymous');

    // 3. Build Payload
    const payload = {
      action,
      userId,
      role: userRole,
      ip: extractIp(req),
      resource: {
        type: resource.type,
        id: String(resource.id), // Ensure ID is always a string
      },
      metadata: metadata || null,
    };

    // 4. Fire-and-Forget Save
    await AuditLog.createLog(payload);

  } catch (err) {
    // NEVER throw — audit failure must not break main flow
    // In production, you might send this to Sentry/Datadog
    console.error('❌ Audit log failed:', err.message);
  }
}

module.exports = {
  logAction,
};
