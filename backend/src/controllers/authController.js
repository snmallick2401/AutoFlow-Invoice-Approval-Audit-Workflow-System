// backend/src/controllers/authController.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { logAction } = require("../utils/auditLogger");

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }

  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
};

const sanitizeUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
});

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,
    });

    await user.save();

    const token = generateToken(user);

    try {
      logAction({
        req,
        action: "USER_REGISTERED",
        user: { id: user._id, role: user.role },
        resource: { type: "User", id: user._id.toString() },
      });
    } catch (_) {}

    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    const auditUser = user
      ? { id: user._id, role: user.role }
      : { id: null, role: null };

    if (!user) {
      try {
        logAction({
          req,
          action: "USER_LOGIN_FAILED",
          user: auditUser,
          metadata: { reason: "user_not_found" },
        });
      } catch (_) {}

      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      try {
        logAction({
          req,
          action: "USER_LOGIN_FAILED",
          user: auditUser,
          metadata: { reason: "wrong_password" },
        });
      } catch (_) {}

      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    try {
      logAction({
        req,
        action: "USER_LOGIN",
        user: auditUser,
        resource: { type: "User", id: user._id.toString() },
      });
    } catch (_) {}

    return res.status(200).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    return res.status(200).json(sanitizeUser(req.user));
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  register,
  login,
  getMe,
};
