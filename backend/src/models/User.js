/**
 * User Model — AutoFlow
 * =================================================
 * Responsibilities:
 * - Define user schema with strict validation
 * - Handle password hashing (bcrypt)
 * - Sanitize output (remove sensitive data)
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Allowed Roles for RBAC
const ROLES = ['admin', 'employee', 'manager', 'finance'];

// Standard Email Regex for validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [EMAIL_REGEX, 'Please provide a valid email address'],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type: String,
      enum: {
        values: ROLES,
        message: '{VALUE} is not a valid role',
      },
      default: 'employee',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// --------------------------------------------------
// Static Properties
// --------------------------------------------------
userSchema.statics.ROLES = ROLES;

// --------------------------------------------------
// Middleware (Hooks)
// --------------------------------------------------
/**
 * Pre-save hook to hash password.
 * Restored the 'next' parameter to ensure the middleware chain 
 * completes properly for audit logging and database synchronization.
 */
userSchema.pre('save', async function (next) {
  try {
    // 1. If password isn't modified, skip hashing and move to the next middleware
    if (!this.isModified('password')) {
      return next();
    }

    // 2. Generate salt and hash the password
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    
    // 3. Signal that this middleware is complete
    next();
  } catch (err) {
    // 4. Pass errors to the next error-handling middleware
    next(err);
  }
});

// --------------------------------------------------
// Instance Methods
// --------------------------------------------------
/**
 * Compare provided plain-text password with stored hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.matchPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Clean the user object before sending it to the frontend.
 * Removes password hashes and internal Mongoose version keys.
 */
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
