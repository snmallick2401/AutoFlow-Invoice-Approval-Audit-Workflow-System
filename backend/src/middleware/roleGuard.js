// backend/src/middleware/roleGuard.js

/**
 * Role Guard Middleware
 * ---------------------
 * Enforces Role-Based Access Control (RBAC).
 * usage: router.get('/admin', protect, roleGuard('admin'), adminController);
 */
const roleGuard = (...allowedRoles) => {
  // Defensive validation of configuration
  if (!allowedRoles || allowedRoles.length === 0) {
    throw new Error('roleGuard configuration error: at least one role is required');
  }

  return (req, res, next) => {
    // 1. Ensure authentication middleware (protect) has run first
    if (!req.user || !req.user.role) {
      console.warn('⚠️ RoleGuard blocked request: User not authenticated or missing role.');
      return res.status(401).json({
        message: 'Authentication required before role verification',
      });
    }

    const userRole = req.user.role;

    // 2. Check Permissions
    if (!allowedRoles.includes(userRole)) {
      console.warn(`⛔ Access Denied: User role '${userRole}' attempted to access restricted route.`);
      return res.status(403).json({
        message: 'Access denied: Insufficient privileges',
      });
    }

    // 3. Authorized
    next();
  };
};

module.exports = roleGuard;
