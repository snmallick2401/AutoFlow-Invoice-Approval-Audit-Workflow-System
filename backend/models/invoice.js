// backend/src/models/Invoice.js
const mongoose = require('mongoose');

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const APPROVAL_ACTIONS = ['APPROVED', 'REJECTED'];

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
    _id: false,
    strict: true,
  }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      required: [true, 'invoiceId is required'],
      unique: true,
      index: true,
      trim: true,
      immutable: true,
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
    status: {
      type: String,
      enum: STATUSES,
      default: 'PENDING',
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
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

invoiceSchema.index({ submittedBy: 1, createdAt: -1 });

// Prevent modification of finalized invoices
invoiceSchema.pre('save', async function () {
  if (this.isNew) return;

  if (
    ['APPROVED', 'REJECTED'].includes(this.status) &&
    this.isModified()
  ) {
    throw new Error('Finalized invoices cannot be modified');
  }
});

invoiceSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
