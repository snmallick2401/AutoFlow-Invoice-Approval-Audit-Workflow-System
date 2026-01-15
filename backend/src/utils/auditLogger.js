// backend/src/utils/auditLogger.js
const AuditLog = require('../models/AuditLog');

function extractIp(req) {
  if (!req) return null;

  const xfwd = req.headers && req.headers['x-forwarded-for'];
  if (xfwd && typeof xfwd === 'string') {
    return xfwd.split(',')[0].trim();
  }

  return req.ip || req.connection?.remoteAddress || null;
}

async function logAction(params) {
  try {
    if (!params || !params.action || !params.user || !params.resource) {
      return;
    }

    const payload = {
      action: params.action,
      userId: params.user.id,
      role: params.user.role,
      ip: extractIp(params.req),
      resource: {
        type: params.resource.type,
        id: String(params.resource.id),
      },
      metadata: params.metadata || null,
    };

    await AuditLog.createLog(payload);
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = {
  logAction,
};
