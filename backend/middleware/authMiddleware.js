// backend/src/middleware/authMiddleware.js
/**
 * Authentication & Authorization Middleware
 * - Verifies JWT token
 * - Attaches authenticated user to req.user
 * - Supports role-based access control
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes – requires valid JWT
 */
const protect = async (req, res, next) => {
  let token;

  // Expect token as: Authorization: Bearer <token>
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB and attach to request
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

/**
 * Role-based access control
 * @param {...string} allowedRoles
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Access denied: insufficient permissions',
      });
    }

    next();
  };
};

module.exports = {
  protect,
  authorize,
};
