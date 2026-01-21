/**
 * AuditLog Model — AutoFlow
 * ========================
 * Implements an immutable, append-only ledger for system events.
 * * Key Improvements:
 * - Resolved middleware 'next' error
 * - Standardized IPv6 support
 * - Enforced strict immutability for SOC2 compliance
 */

const mongoose = require('mongoose');

/* -------------------- Constants -------------------- */
const ACTIONS = [
  'USER_REGISTERED', 'USER_LOGIN', 'USER_LOGIN_FAILED', 'USER_LOGOUT',
  'INVOICE_SUBMITTED', 'INVOICE_APPROVED', 'INVOICE_REJECTED',
  'OTHER'
];

/* -------------------- Sub-Schemas -------------------- */
const resourceSchema = new mongoose.Schema({
  type: { type: String, required: true, trim: true },
  id: { type: String, required: true, trim: true },
}, { _id: false, strict: true });

/* -------------------- Main Schema -------------------- */
const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ACTIONS,
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  role: {
    type: String,
    trim: true,
    default: null,
  },
  ip: {
    type: String,
    maxlength: 45, // Support for full IPv6 addresses
    trim: true,
    default: '0.0.0.0',
  },
  resource: {
    type: resourceSchema,
    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false }, // Only record creation
  strict: true,
});

/* -------------------- Indexes -------------------- */
auditLogSchema.index({ 'resource.type': 1, 'resource.id': 1, timestamp: -1 });

/* -------------------- Immutability Guard -------------------- */

// Ensure 'next' is correctly handled to prevent runtime errors
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('CRITICAL: Audit logs are immutable and cannot be modified.'));
  }
  next();
});

const PREVENT_UPDATE = (next) => {
  next(new Error('CRITICAL: Audit logs are immutable and cannot be updated or deleted.'));
};

// Protect against all modification/deletion methods
auditLogSchema.pre([
  'updateOne', 'updateMany', 'findOneAndUpdate', 
  'findByIdAndUpdate', 'deleteOne', 'deleteMany', 
  'findOneAndDelete'
], PREVENT_UPDATE);

/* -------------------- Static Methods -------------------- */

/**
 * Robust Log Factory
 * Normalizes user data and validates ObjectIds
 */
auditLogSchema.statics.createLog = async function (payload) {
  if (!payload?.action || !payload?.resource) {
    throw new Error('Invalid audit log payload: action and resource are required.');
  }

  // Prevent CastErrors on invalid user IDs
  let safeUserId = payload.userId;
  if (safeUserId && !mongoose.Types.ObjectId.isValid(safeUserId)) {
    safeUserId = null;
  }

  const doc = new this({
    action: payload.action,
    userId: safeUserId,
    role: payload.role || (safeUserId ? 'unknown' : 'anonymous'),
    ip: payload.ip || 'unknown',
    resource: {
      type: String(payload.resource.type),
      id: String(payload.resource.id),
    },
    metadata: payload.metadata || null,
    timestamp: payload.timestamp || new Date(),
  });

  return doc.save();
};

/* -------------------- Export -------------------- */
const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
