// backend/src/utils/workflowEngine.js

function getExpectedRole(invoice) {
  if (invoice.status !== 'PENDING') return null;

  // No approvals yet → manager stage
  if (!invoice.approvalHistory || invoice.approvalHistory.length === 0) {
    return 'manager';
  }

  // Find last approval action
  const last = invoice.approvalHistory[invoice.approvalHistory.length - 1];

  // If Manager approved, next is Finance
  if (last.action === 'APPROVED' && last.role === 'manager') {
    return 'finance';
  }

  return null;
}

function processAction({ invoice, user, action, comment }) {
  if (!invoice) throw new Error('Invoice is required');
  if (!user || !user.id || !user.role) throw new Error('User context is required');
  if (!['APPROVE', 'REJECT'].includes(action)) throw new Error('Invalid action');

  if (invoice.status === 'APPROVED' || invoice.status === 'REJECTED') {
    throw new Error('Invoice is already finalized');
  }

  const expectedRole = getExpectedRole(invoice);

  if (!expectedRole) {
    throw new Error('No further approvals allowed for this invoice');
  }

  // Strict role check (Admins must act as the specific role if logic requires)
  if (user.role !== expectedRole && user.role !== 'admin') {
    throw new Error(`Action not allowed. Expected role: ${expectedRole}`);
  }

  // If Admin is overriding, record them as the expected role to maintain workflow chain integrity
  const effectiveRole = user.role === 'admin' ? expectedRole : user.role;

  const historyEntry = {
    action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    by: user.id,
    role: effectiveRole,
    timestamp: new Date(),
    comment: comment || null,
  };

  invoice.approvalHistory.push(historyEntry);

  if (action === 'REJECT') {
    invoice.status = 'REJECTED';
    invoice.currentApprover = null;
    return invoice;
  }

  // APPROVE flow
  if (effectiveRole === 'manager') {
    // Move to finance stage
    invoice.status = 'PENDING';
    invoice.currentApprover = null;
    return invoice;
  }

  if (effectiveRole === 'finance') {
    // Final approval
    invoice.status = 'APPROVED';
    invoice.currentApprover = null;
    return invoice;
  }

  throw new Error('Unhandled workflow state');
}

module.exports = {
  processAction,
  getExpectedRole,
};
