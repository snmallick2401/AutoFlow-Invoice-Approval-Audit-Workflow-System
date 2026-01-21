// backend/src/utils/invoiceIdGenerator.js
/**
 * Invoice ID Generator Utility — AutoFlow
 * ======================================
 *
 * Responsibilities:
 * - Generate unique, sequential, human-readable invoice IDs (e.g., INV-2026-000001)
 * - Use MongoDB atomic counters for concurrency safety
 * - Graceful fallback to random IDs if Database is offline
 */

const mongoose = require('mongoose');
const crypto = require('crypto');

// --------------------------------------------------
// Counter Schema
// --------------------------------------------------
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. "invoiceId:2026"
    seq: { type: Number, default: 0 },
  },
  {
    collection: 'counters',
    versionKey: false,
    strict: true,
  }
);

// Prevent model overwrite in serverless/hot-reload environments
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

// --------------------------------------------------
// Defaults
// --------------------------------------------------
const DEFAULT_PADDING = 6;
const DEFAULT_PREFIX = (year) => `INV-${year}`;

// --------------------------------------------------
// Validation Helper
// --------------------------------------------------
function validateOptions(options = {}) {
  if (options.padding !== undefined) {
    if (!Number.isInteger(options.padding) || options.padding < 1 || options.padding > 20) {
      throw new RangeError('padding must be an integer between 1 and 20');
    }
  }

  if (
    options.prefix !== undefined &&
    typeof options.prefix !== 'string' &&
    typeof options.prefix !== 'function'
  ) {
    throw new TypeError('prefix must be a string or function(year)');
  }
}

// --------------------------------------------------
// Generate Invoice ID (MAIN API)
// --------------------------------------------------
async function generateInvoiceId(options = {}) {
  validateOptions(options);

  const year = options.year || new Date().getFullYear();
  const padding = options.padding || DEFAULT_PADDING;
  const prefixFn = options.prefix || DEFAULT_PREFIX;

  // Resolve prefix (e.g., "INV-2026")
  const prefix = typeof prefixFn === 'function' ? prefixFn(year) : prefixFn;

  // Check DB Connection State (1 = Connected)
  const isMongoConnected = mongoose.connection && mongoose.connection.readyState === 1;

  // --------------------------------------------------
  // A. OFFLINE FALLBACK (Resiliency)
  // --------------------------------------------------
  if (!isMongoConnected) {
    console.warn('⚠️ Invoice ID Generator running in OFFLINE mode (MongoDB disconnected)');
    // Use crypto for secure randomness to prevent collisions during outages
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 chars
    const timestamp = Date.now().toString().slice(-4); // Last 4 digits of time
    return `${prefix}-OFFLINE-${timestamp}${randomSuffix}`;
  }

  // --------------------------------------------------
  // B. ATOMIC DB INCREMENT (Standard Operation)
  // --------------------------------------------------
  const counterId = `invoiceId:${year}`;

  try {
    const doc = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      {
        new: true,                 // Return the updated document
        upsert: true,              // Create if it doesn't exist
        setDefaultsOnInsert: true,
      }
    ).lean();

    const seq = doc.seq;
    // Format: INV-2026-000001
    return `${prefix}-${String(seq).padStart(padding, '0')}`;

  } catch (err) {
    console.error('❌ invoiceIdGenerator Critical Error:', err.message);

    // Emergency fallback if DB fails mid-operation
    const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-ERR-${randomSuffix}`;
  }
}

// --------------------------------------------------
// Diagnostics / Maintenance Helpers
// --------------------------------------------------
async function getCurrentSeq(year = new Date().getFullYear()) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return null;
  const doc = await Counter.findById(`invoiceId:${year}`).lean();
  return doc ? doc.seq : 0;
}

async function setSeq(value, year = new Date().getFullYear()) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError('value must be a non-negative integer');
  }

  const doc = await Counter.findOneAndUpdate(
    { _id: `invoiceId:${year}` },
    { $set: { seq: value } },
    { new: true, upsert: true }
  ).lean();

  return doc.seq;
}

// --------------------------------------------------
// Exports
// --------------------------------------------------
module.exports = {
  generateInvoiceId,
  getCurrentSeq,
  setSeq,
};
