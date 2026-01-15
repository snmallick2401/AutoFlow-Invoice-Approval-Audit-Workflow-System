// backend/src/models/AuditLog.js
const mongoose = require('mongoose');

const ACTIONS = [
  'USER_REGISTERED',
  'USER_LOGIN',
  'USER_LOGIN_FAILED',
  'USER_LOGOUT',
  'INVOICE_SUBMITTED',
  'INVOICE_APPROVED',
  'INVOICE_REJECTED',
  'OTHER',
];

const resourceSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    id: { type: String, required: true, trim: true },
  },
  { _id: false, strict: true }
);

const auditLogSchema = new mongoose.Schema(
  {
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
      maxlength: 100,
      trim: true,
      default: null,
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
      default: () => new Date(),
      index: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

auditLogSchema.index({ 'resource.type': 1, 'resource.id': 1, timestamp: -1 });

// Enforce immutability
auditLogSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Audit logs are immutable and cannot be modified');
  }
});

['updateOne', 'updateMany', 'findOneAndUpdate', 'findByIdAndUpdate'].forEach(
  (hook) => {
    auditLogSchema.pre(hook, function () {
      throw new Error('Audit logs are immutable and cannot be updated');
    });
  }
);

auditLogSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

/**
 * @param {{
 * action: string,
 * userId?: ObjectId|string|null,
 * role?: string|null,
 * ip?: string,
 * resource: { type: string, id: string|ObjectId },
 * metadata?: any
 * }} payload
 */
auditLogSchema.statics.createLog = async function (payload) {
  if (!payload || !payload.action || !payload.resource) {
    throw new Error('Invalid audit log payload');
  }

  const doc = new this({
    action: payload.action,
    userId: payload.userId || null,
    role: payload.role || null,
    ip: payload.ip || null,
    resource: {
      type: payload.resource.type,
      id: String(payload.resource.id),
    },
    metadata: payload.metadata || null,
    timestamp: payload.timestamp || new Date(),
  });

  return doc.save();
};

const AuditLog =
  mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
