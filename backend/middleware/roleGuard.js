// backend/src/middleware/roleGuard.js
/**
 * Role Guard Middleware
 * ---------------------
 * Purpose:
 * - Enforce Role-Based Access Control (RBAC) at the ROUTE level
 * - Act as a FIRST LINE OF DEFENSE before controllers and workflow engine
 *
 * ===================== SELF-AUDIT =====================
 * LOGIC:
 * - Accepts one or more allowed roles
 * - Compares against authenticated user's role (req.user.role)
 * - Denies access early if role mismatch
 *
 * SECURITY:
 * - Assumes authentication middleware (protect) has already run
 * - Does NOT trust client input; relies on server-verified JWT payload
 * - Prevents unauthorized roles from reaching business logic
 *
 * DATA INTEGRITY:
 * - Does not mutate req.user or any request data
 * - Pure authorization check only
 *
 * FAILURE MODES:
 * - 401 if user is not authenticated
 * - 403 if user role is not permitted
 *
 * EXTENSIBILITY:
 * - Supports multiple roles per route
 * - Easy to extend to role hierarchies if needed
 */

/**
 * roleGuard middleware factory
 * @param {...string} allowedRoles
 */
const roleGuard = (...allowedRoles) => {
  // Defensive validation of configuration
  if (!allowedRoles || allowedRoles.length === 0) {
    throw new Error('roleGuard requires at least one allowed role');
  }

  return (req, res, next) => {
    // Ensure authentication middleware has run
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        message: 'Authentication required',
      });
    }

    const userRole = req.user.role;

    // Check role permission
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: 'Access denied: insufficient role privileges',
        requiredRoles: allowedRoles,
        userRole,
      });
    }

    // Authorized
    next();
  };
};

module.exports = roleGuard;
