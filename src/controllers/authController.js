// backend/src/controllers/authController.js

/**
 * Auth Controller — AutoFlow
 * =================================================
 * Responsibilities:
 * - Handle User Registration & Login
 * - Issue JWT Tokens
 * - Enforce robust error handling & input validation
 * - Audit log all authentication attempts (Success/Failure)
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { logAction } = require("../utils/auditLogger");

// Configuration
const ALLOWED_ROLES = ['employee', 'manager', 'finance', 'admin'];
const PASSWORD_MIN_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* =================================================
   Helpers
================================================= */

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET is not defined in .env");
  }
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
};

const sanitizeUser = (user) => ({
  _id: user._id.toString(), // Standardize on _id for frontend compatibility
  id: user._id.toString(),  // Keep alias just in case
  name: user.name,
  email: user.email,
  role: user.role,
});

/* =================================================
   POST /api/auth/register
================================================= */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Basic Field Presence
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    // 2. format Validation (Security)
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ 
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long` 
      });
    }

    // 3. Validate Role
    // Default to 'employee' if not specified.
    let userRole = 'employee';
    if (role) {
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ 
          message: `Invalid role. Allowed: ${ALLOWED_ROLES.join(', ')}` 
        });
      }
      userRole = role;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 4. Check Duplicates
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" });
    }

    // 5. Create User
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password, // Hashing happens in User model pre-save hook
      role: userRole,
    });

    await user.save();

    // 6. Generate Token
    const token = generateToken(user);

    // 7. Audit Log (Non-blocking)
    await logAction({
      req,
      action: "USER_REGISTERED",
      user: { id: user._id, role: user.role },
      resource: { type: "User", id: user._id.toString() },
    });

    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error during registration" });
  }
};

/* =================================================
   POST /api/auth/login
================================================= */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Prepare audit context (Safe handling if user not found)
    const auditUser = user
      ? { id: user._id, role: user.role }
      : { id: null, role: "anonymous" };

    // 1. Check User Existence
    if (!user) {
      await logAction({
        req,
        action: "USER_LOGIN_FAILED",
        user: auditUser,
        resource: { type: "AuthAttempt", id: normalizedEmail }, 
        metadata: { reason: "user_not_found" },
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 2. Check Password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await logAction({
        req,
        action: "USER_LOGIN_FAILED",
        user: auditUser,
        resource: { type: "AuthAttempt", id: normalizedEmail }, 
        metadata: { reason: "wrong_password" },
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 3. Success
    const token = generateToken(user);

    await logAction({
      req,
      action: "USER_LOGIN",
      user: auditUser,
      resource: { type: "User", id: user._id.toString() },
    });

    return res.status(200).json({
      token,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error during login" });
  }
};

/* =================================================
   GET /api/auth/me
================================================= */
const getMe = async (req, res) => {
  try {
    // req.user is set by the 'protect' middleware
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Return sanitized user data
    return res.status(200).json(sanitizeUser(req.user));
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ message: "Server error fetching user profile" });
  }
};

module.exports = { register, login, getMe };
