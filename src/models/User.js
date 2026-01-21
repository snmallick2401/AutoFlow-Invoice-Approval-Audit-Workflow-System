// backend/src/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Allowed Roles
const ROLES = ['admin', 'employee', 'manager', 'finance'];

// Email Regex
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

userSchema.statics.ROLES = ROLES;

// =========================================================
//  FIXED MIDDLEWARE: Removed 'next' parameter
// =========================================================
userSchema.pre('save', async function () {
  // 1. If password isn't modified, return immediately (Promise resolves)
  if (!this.isModified('password')) return;

  // 2. Hash the password
  // Mongoose automatically catches errors from async functions
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
