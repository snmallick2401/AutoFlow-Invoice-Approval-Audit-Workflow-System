// backend/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect Middleware
 * Verifies the JWT token from the 'Authorization' header.
 * Attaches the user object to 'req.user' if valid.
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // 1. Get token from header (Format: "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // 2. Safety Check: Ensure Secret exists
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment');
      }

      // 3. Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4. Get user from the token (exclude password hash)
      // Note: We use 'decoded.id' because that's how we signed it in authController
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      console.error('Auth Middleware Error:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

/**
 * Authorize Middleware (Role Guard)
 * Restricts access to specific roles.
 * Usage: authorize('admin', 'finance')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // req.user is set by the 'protect' middleware previously
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `User role '${req.user ? req.user.role : 'unknown'}' is not authorized to access this route` 
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
