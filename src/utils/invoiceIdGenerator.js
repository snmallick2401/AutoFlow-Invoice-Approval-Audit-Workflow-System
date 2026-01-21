// backend/src/utils/invoiceIdGenerator.js
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  {
    collection: 'counters',
    versionKey: false,
  }
);

const Counter =
  mongoose.models.Counter || mongoose.model('Counter', counterSchema);

const DEFAULT_PADDING = 6;
const DEFAULT_PREFIX = (year) => `INV-${year}`;

function validateOptions(options = {}) {
  if (options.padding !== undefined) {
    if (
      !Number.isInteger(options.padding) ||
      options.padding < 1 ||
      options.padding > 12
    ) {
      throw new RangeError('padding must be an integer between 1 and 12');
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

async function generateInvoiceId(options = {}) {
  validateOptions(options);

  const year = options.year || new Date().getFullYear();
  const padding = options.padding || DEFAULT_PADDING;
  const prefixFn = options.prefix || DEFAULT_PREFIX;

  const prefix =
    typeof prefixFn === 'function' ? prefixFn(year) : prefixFn;

  const isMongoConnected =
    mongoose.connection && mongoose.connection.readyState === 1;

  // Fallback if DB is not available
  if (!isMongoConnected) {
    const ts = Date.now();
    const rnd = Math.floor(Math.random() * 1e6);
    return `${prefix}-${ts}-${String(rnd).padStart(padding, '0')}`;
  }

  const counterId = `invoiceId:${year}`;

  try {
    const doc = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    const seq = doc.seq;
    return `${prefix}-${String(seq).padStart(padding, '0')}`;
  } catch (err) {
    console.error('invoiceIdGenerator error:', err.message);

    // Emergency fallback
    const ts = Date.now();
    const rnd = Math.floor(Math.random() * 1e6);
    return `${prefix}-${ts}-${String(rnd).padStart(padding, '0')}`;
  }
}

async function getCurrentSeq(year = new Date().getFullYear()) {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return null;
  }

  const doc = await Counter.findById(`invoiceId:${year}`).lean();
  return doc ? doc.seq : null;
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

module.exports = {
  generateInvoiceId,
  getCurrentSeq,
  setSeq,
};
