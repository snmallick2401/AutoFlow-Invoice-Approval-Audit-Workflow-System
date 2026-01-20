// backend/public/js/dashboard.js
"use strict";

(() => {
  const CONFIG = {
    TOKEN_KEY: "autoflow_token",
    USER_KEY: "autoflow_user",
  };

  const state = {
    currentUser: null,
    pendingRejectId: null,
    ui: {}
  };

  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheDOM();
    attachEventListeners();
    loadUserFromStorage();

    // Load data in parallel for faster TTI (Time to Interactive)
    await Promise.allSettled([
      populateUserHeader(),
      loadDashboardSummary(),
      loadRecentInvoices(),
      loadApprovalsIfApprover(),
      loadActivityLog()
    ]);
  }

  function cacheDOM() {
    const get = (id) => document.getElementById(id);

    state.ui = {
      // Layout
      userName: get("userName"),
      userRole: get("userRole"),
      sidebar: get("sidebar"),
      sidebarToggle: get("sidebarToggle"),
      sidebarOverlay: get("sidebarOverlay"),
      logoutBtn: get("logoutBtn"),

      // KPIs
      kpiTotal: get("kpiTotal"),
      kpiPending: get("kpiPending"),
      kpiApprovedValue: get("kpiApprovedValue"),
      kpiRejected: get("kpiRejected"),

      // Tables & Lists
      recentInvoicesBody: get("recentInvoicesBody"),
      invoicesLoading: get("invoicesLoading"),
      invoicesEmpty: get("invoicesEmpty"),
      
      approvalsList: get("approvalsList"),
      approvalsLoading: get("approvalsLoading"),
      approvalsEmpty: get("approvalsEmpty"),
      refreshApprovalsBtn: get("refreshApprovals"),
      
      activityList: get("activityList"),

      // Modal
      rejectModal: get("rejectModal"),
      rejectReason: get("rejectReason"),
      rejectError: get("rejectError"),
      cancelRejectBtn: get("cancelRejectBtn"),
      rejectConfirmBtn: get("rejectConfirmBtn")
    };
  }

  function attachEventListeners() {
    const ui = state.ui;

    if (ui.sidebarToggle) {
      ui.sidebarToggle.addEventListener("click", (e) => {
        e.preventDefault();
        const sb = document.getElementById("sidebar");
        if(window.innerWidth < 768) sb.classList.toggle("open");
        else sb.classList.toggle("collapsed");
      });
    }
    
    if (ui.sidebarOverlay) {
      ui.sidebarOverlay.addEventListener("click", () => {
        document.getElementById("sidebar").classList.remove("open");
      });
    }

    if (ui.logoutBtn) ui.logoutBtn.addEventListener("click", logout);
    if (ui.refreshApprovalsBtn) ui.refreshApprovalsBtn.addEventListener("click", loadApprovalsIfApprover);

    if (ui.cancelRejectBtn) ui.cancelRejectBtn.addEventListener("click", closeRejectModal);
    if (ui.rejectConfirmBtn) ui.rejectConfirmBtn.addEventListener("click", onRejectConfirm);
  }

  // --- API Wrapper ---
  async function callApi(endpoint, options = {}) {
    if (typeof window.apiFetch !== "function") return null;
    try {
      return await window.apiFetch(endpoint, options);
    } catch (err) {
      console.error(`API Error ${endpoint}:`, err);
      return null;
    }
  }

  // --- Data Loading ---

  function loadUserFromStorage() {
    try {
      const raw = sessionStorage.getItem(CONFIG.USER_KEY) || localStorage.getItem(CONFIG.USER_KEY);
      if (raw) state.currentUser = JSON.parse(raw);
    } catch (e) {}
  }

  async function populateUserHeader() {
    // Attempt fresh fetch, fallback to storage
    const data = await callApi("/api/auth/me");
    if (data && (data.user || data.email)) {
      state.currentUser = data.user || data;
    }

    const ui = state.ui;
    const user = state.currentUser || {};
    
    if (ui.userName) ui.userName.textContent = user.name || user.email || "Guest";
    if (ui.userRole) {
      const role = (user.role || "user").toLowerCase();
      ui.userRole.textContent = role.toUpperCase();
      ui.userRole.className = `role-badge ${role}`;
    }
  }

  async function loadDashboardSummary() {
    const data = await callApi("/api/dashboard/summary");
    if (!data) return;

    const ui = state.ui;
    if (ui.kpiTotal) ui.kpiTotal.textContent = data.totalInvoices || 0;
    if (ui.kpiPending) ui.kpiPending.textContent = data.pendingApprovals || 0;
    if (ui.kpiApprovedValue) ui.kpiApprovedValue.textContent = formatMoney(data.approvedAmount);
    if (ui.kpiRejected) ui.kpiRejected.textContent = data.rejectedCount || 0;
  }

  async function loadRecentInvoices() {
    const ui = state.ui;
    if (!ui.recentInvoicesBody) return;

    toggle(ui.invoicesLoading, true);
    toggle(ui.invoicesEmpty, false);
    ui.recentInvoicesBody.innerHTML = "";

    // Fetch user's own invoices
    const res = await callApi("/api/invoice/my");
    toggle(ui.invoicesLoading, false);

    const invoices = res?.invoices || [];
    if (invoices.length === 0) {
      toggle(ui.invoicesEmpty, true);
      return;
    }

    // Show top 5
    invoices.slice(0, 5).forEach(inv => {
      const tr = document.createElement("tr");
      const status = inv.status.toLowerCase();
      tr.innerHTML = `
        <td><span class="muted">${inv.invoiceId}</span></td>
        <td>${escapeHtml(inv.vendorName)}</td>
        <td>${formatDate(inv.invoiceDate)}</td>
        <td>${formatMoney(inv.amount)}</td>
        <td><span class="status status-${status}">${status}</span></td>
      `;
      ui.recentInvoicesBody.appendChild(tr);
    });
  }

  async function loadApprovalsIfApprover() {
    const ui = state.ui;
    if (!ui.approvalsList) return;

    // Only fetch if user has permission
    const role = state.currentUser?.role;
    if (!['manager', 'finance', 'admin'].includes(role)) {
      ui.approvalsList.innerHTML = `<li class="muted" style="padding:1rem;">Access restricted to approvers.</li>`;
      toggle(ui.approvalsLoading, false);
      return;
    }

    toggle(ui.approvalsLoading, true);
    toggle(ui.approvalsEmpty, false);
    ui.approvalsList.innerHTML = "";

    // CORRECTED: Use the query param endpoint
    const res = await callApi("/api/invoice?status=pending");
    toggle(ui.approvalsLoading, false);

    const invoices = res?.invoices || [];
    if (invoices.length === 0) {
      toggle(ui.approvalsEmpty, true);
      return;
    }

    invoices.slice(0, 5).forEach(inv => {
      const li = document.createElement("li");
      li.className = "approval-item";
      li.innerHTML = `
        <div class="approval-info">
          <strong>${escapeHtml(inv.vendorName)}</strong>
          <span class="muted small">
             ${formatMoney(inv.amount)} • ${inv.submittedBy?.name || 'User'}
          </span>
        </div>
        <div class="approval-actions"></div>
      `;
      
      const actions = li.querySelector(".approval-actions");
      
      // Approve Button
      const btnApprove = createBtn("✔", "var(--success)", () => processInvoice(inv.invoiceId, "APPROVED"));
      // Reject Button
      const btnReject = createBtn("✕", "var(--danger)", () => openRejectModal(inv.invoiceId));

      actions.append(btnApprove, btnReject);
      ui.approvalsList.appendChild(li);
    });
  }

  async function loadActivityLog() {
    const ui = state.ui;
    if (!ui.activityList) return;

    ui.activityList.innerHTML = '<li class="muted">Loading...</li>';
    
    // CORRECTED: Fetch real audit logs
    const res = await callApi("/api/audit?limit=5");
    ui.activityList.innerHTML = "";

    const logs = res?.logs || [];
    if (logs.length === 0) {
      ui.activityList.innerHTML = '<li class="muted">No recent activity.</li>';
      return;
    }

    logs.forEach(log => {
      const li = document.createElement("li");
      li.className = "activity-item";
      // Format: "User X submitted invoice..."
      const actor = log.userId?.name || "System";
      const action = formatActionName(log.action);
      const time = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      li.innerHTML = `
        <span class="muted" style="font-size:0.75rem; min-width:50px;">${time}</span>
        <span><strong>${actor}</strong> ${action}</span>
      `;
      ui.activityList.appendChild(li);
    });
  }

  // --- Actions ---

  async function processInvoice(id, status, reason = null) {
    if (status === "APPROVED" && !confirm("Confirm approval?")) return;

    // CORRECTED: Use the route /api/invoice/:id/status
    const body = { status };
    if (reason) body.reason = reason;

    const res = await callApi(`/api/invoice/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body)
    });

    if (res) {
      if (status === "REJECTED") closeRejectModal();
      refreshAll();
    }
  }

  function openRejectModal(id) {
    state.pendingRejectId = id;
    const ui = state.ui;
    ui.rejectReason.value = "";
    ui.rejectError.classList.add("hidden");
    ui.rejectModal.classList.remove("hidden");
  }

  function onRejectConfirm() {
    const ui = state.ui;
    const reason = ui.rejectReason.value.trim();
    
    if (!reason) {
      ui.rejectError.classList.remove("hidden");
      return;
    }
    
    processInvoice(state.pendingRejectId, "REJECTED", reason);
  }

  function closeRejectModal() {
    state.ui.rejectModal.classList.add("hidden");
    state.pendingRejectId = null;
  }

  async function refreshAll() {
    await Promise.allSettled([
      loadDashboardSummary(),
      loadApprovalsIfApprover(),
      loadRecentInvoices(),
      loadActivityLog()
    ]);
  }

  function logout() {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = "index.html"; // Redirect to index (login)
  }

  // --- Helpers ---

  function toggle(el, show) {
    if(el) show ? el.classList.remove("hidden") : el.classList.add("hidden");
  }

  function createBtn(text, color, onClick) {
    const btn = document.createElement("button");
    btn.className = "icon-btn small";
    btn.style.color = color;
    btn.textContent = text;
    btn.onclick = onClick;
    return btn;
  }

  function formatMoney(val) {
    return currencyFormatter.format(Number(val) || 0);
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString();
  }

  function formatActionName(action) {
    const map = {
      'USER_LOGIN': 'logged in',
      'INVOICE_SUBMITTED': 'submitted an invoice',
      'INVOICE_APPROVED': 'approved an invoice',
      'INVOICE_REJECTED': 'rejected an invoice'
    };
    return map[action] || action.toLowerCase().replace(/_/g, ' ');
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }

})();
