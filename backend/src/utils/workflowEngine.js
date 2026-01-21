// backend/src/utils/workflowEngine.js
/**
 * Workflow Engine for Invoice Approvals
 * ------------------------------------
 * Responsibilities:
 * - Validate approval sequence (Manager -> Finance)
 * - Allow Admins to override/supervise workflow
 * - Enforce Segregation of Duties (SoD)
 * - Generate immutable history entries
 */

/**
 * Determine which role is allowed to act next
 * @param {Object} invoice
 * @returns {string|null} expectedRole ('manager' | 'finance' | null)
 */
function getExpectedRole(invoice) {
  // If not pending, no roles are expected (workflow is done)
  if (invoice.status !== 'PENDING') return null;

  // 1. Fresh invoice (no history) -> Manager must approve first
  if (!invoice.approvalHistory || invoice.approvalHistory.length === 0) {
    return 'manager';
  }

  // 2. Check the last action
  const last = invoice.approvalHistory[invoice.approvalHistory.length - 1];

  // 3. Determine Next Step
  if (last.action === 'APPROVED') {
    // If the last approval was by a Manager (or an Admin acting as Manager),
    // the next step is Finance.
    // Note: If Finance had approved, the status would be 'APPROVED', 
    // so we wouldn't be in this function (caught by status check above).
    if (last.role === 'manager' || last.role === 'admin') {
      return 'finance';
    }
  }

  // Default: No role expected (e.g., if last action was REJECTED, status handles it)
  return null;
}

/**
 * Core workflow processor
 * @param {Object} params
 * @param {Object} params.invoice - invoice document
 * @param {Object} params.user - acting user ({ id, role })
 * @param {'APPROVE'|'REJECT'} params.action
 * @param {string} [params.comment]
 */
function processAction({ invoice, user, action, comment }) {
  // --------- 1. Basic Guards ---------
  if (!invoice) throw new Error('Invoice is required');
  if (!user || !user.id || !user.role) throw new Error('User context is required');
  if (!['APPROVE', 'REJECT'].includes(action)) throw new Error('Invalid action');

  if (invoice.status === 'APPROVED' || invoice.status === 'REJECTED') {
    throw new Error(`Invoice is already finalized as ${invoice.status}`);
  }

  // --------- 2. Segregation of Duties (SoD) ---------
  // Prevent users from approving their own invoices.
  // Exception: Admins can override this for testing/emergency fixes.
  const submitterId = invoice.submittedBy._id 
    ? invoice.submittedBy._id.toString() 
    : invoice.submittedBy.toString();
  
  if (submitterId === user.id.toString() && user.role !== 'admin') {
    throw new Error('Conflict of Interest: You cannot approve your own invoice.');
  }

  // --------- 3. Role Validation ---------
  const expectedRole = getExpectedRole(invoice);

  if (!expectedRole) {
    throw new Error('No further approvals allowed for this invoice state');
  }

  // ALLOW ADMIN OVERRIDE:
  // If user is Admin, they can act as the "expected role".
  const isAllowed = user.role === expectedRole || user.role === 'admin';

  if (!isAllowed) {
    throw new Error(`Action not allowed. This stage requires role: ${expectedRole.toUpperCase()}`);
  }

  // Determine the "effective role" for logic state transitions
  // (e.g. if Admin approves a fresh invoice, they are effectively the Manager)
  const effectiveRole = user.role === 'admin' ? expectedRole : user.role;

  // --------- 4. Build History Entry ---------
  const historyEntry = {
    action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    by: user.id,
    role: user.role, // Log the ACTUAL role (e.g. 'admin') for audit trails
    timestamp: new Date(),
    comment: comment || null,
  };

  invoice.approvalHistory.push(historyEntry);

  // --------- 5. State Transitions ---------
  
  // Case A: REJECTION (Immediate Stop)
  if (action === 'REJECT') {
    invoice.status = 'REJECTED';
    invoice.currentApprover = null;
    return invoice;
  }

  // Case B: APPROVAL FLOW
  if (effectiveRole === 'manager') {
    // Stage 1 Complete: Manager approved -> Move to Finance Stage
    // Status stays PENDING, but now it logically waits for Finance
    invoice.status = 'PENDING';
    invoice.currentApprover = null; // Could set to specific finance users if needed
    return invoice;
  }

  if (effectiveRole === 'finance') {
    // Stage 2 Complete: Finance approved -> Finalize
    invoice.status = 'APPROVED';
    invoice.currentApprover = null;
    return invoice;
  }

  throw new Error(`Unhandled workflow state for role: ${effectiveRole}`);
}

module.exports = {
  processAction,
  getExpectedRole,
};
