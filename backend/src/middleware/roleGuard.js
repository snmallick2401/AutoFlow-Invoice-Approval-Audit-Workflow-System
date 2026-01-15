// backend/src/middleware/roleGuard.js
const roleGuard = (...allowedRoles) => {
  if (!allowedRoles || allowedRoles.length === 0) {
    throw new Error('roleGuard requires at least one allowed role');
  }

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: 'Access denied: insufficient role privileges',
        requiredRoles: allowedRoles,
        userRole,
      });
    }

    next();
  };
};

module.exports = roleGuard;
