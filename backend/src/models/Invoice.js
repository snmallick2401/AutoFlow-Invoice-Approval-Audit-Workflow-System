// backend/src/models/Invoice.js
/**
 * Invoice Model — AutoFlow
 * =================================================
 * Responsibilities:
 * - Define a strict, auditable invoice schema
 * - Support multi-level approval workflow
 * - Preserve immutable approval history
 */

const mongoose = require('mongoose');

// --------------------------------------------------
// Constants
// --------------------------------------------------
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const APPROVAL_ACTIONS = ['APPROVED', 'REJECTED'];

// --------------------------------------------------
// Approval History Subdocument (IMMUTABLE)
// --------------------------------------------------
const approvalHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: APPROVAL_ACTIONS,
      required: true,
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    _id: false, // Subdocuments don't need their own ID here
    strict: true,
  }
);

// --------------------------------------------------
// Invoice Schema
// --------------------------------------------------
const invoiceSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      required: [true, 'invoiceId is required'],
      unique: true,
      index: true,
      trim: true,
      immutable: true, // Cannot change once created
    },

    vendorName: {
      type: String,
      required: [true, 'vendorName is required'],
      trim: true,
    },

    amount: {
      type: Number,
      required: [true, 'amount is required'],
      min: [0, 'amount must be a non-negative number'],
    },

    invoiceDate: {
      type: Date,
      required: [true, 'invoiceDate is required'],
    },

    // Added: Missing field from frontend form
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    status: {
      type: String,
      enum: STATUSES,
      default: 'PENDING',
      required: true,
      index: true, // Index defined here, so we don't need it below
    },

    // Added: Explicit field for rejection context
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },

    // Tracks who needs to act next (Optional, for advanced routing)
    currentApprover: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    filePath: {
      type: String,
      required: [true, 'filePath is required'],
      trim: true,
      immutable: true,
    },

    approvalHistory: {
      type: [approvalHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// --------------------------------------------------
// Indexes
// --------------------------------------------------
// Optimized for "My Invoices" queries (Compound Index)
invoiceSchema.index({ submittedBy: 1, createdAt: -1 });

// Note: 'status' index is already defined in the schema definition above.
// Duplicate definition removed to prevent Mongoose warning.

// --------------------------------------------------
// Workflow Guard (Security)
// --------------------------------------------------
/**
 * Prevent modification of finalized invoices.
 * Once an invoice is APPROVED or REJECTED, it is read-only.
 * Note: Updated to remove 'next' parameter for async/await pattern.
 */
invoiceSchema.pre('save', async function () {
  if (this.isNew) return;

  // If the document is modified, check the *previous* state in the DB
  if (this.isModified()) {
    const currentInDb = await this.constructor.findById(this._id);
    
    if (currentInDb && ['APPROVED', 'REJECTED'].includes(currentInDb.status)) {
      throw new Error('CRITICAL: Cannot modify an invoice after it has been finalized (Approved/Rejected).');
    }
  }
});

// --------------------------------------------------
// Output Sanitization
// --------------------------------------------------
invoiceSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
