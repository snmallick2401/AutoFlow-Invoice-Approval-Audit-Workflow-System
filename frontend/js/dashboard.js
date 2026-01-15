// frontend/js/dashboard.js
"use strict";

(() => {
  const CONFIG = {
    TOKEN_KEY: "autoflow_token",
    USER_KEY: "autoflow_user",
    API_BASE: (typeof window.API_BASE_URL === "string") ? window.API_BASE_URL : "http://localhost:5000"
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

      // Recent Invoices Table
      recentInvoicesTable: get("recentInvoicesTable"),
      recentInvoicesBody: get("recentInvoicesBody"),
      invoicesLoading: get("invoicesLoading"),
      invoicesEmpty: get("invoicesEmpty"),

      // Approvals Widget
      approvalsList: get("approvalsList"),
      approvalsLoading: get("approvalsLoading"),
      approvalsEmpty: get("approvalsEmpty"),
      refreshApprovalsBtn: get("refreshApprovals"),

      // Activity Widget
      activityList: get("activityList"),

      // Reject Modal
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
        toggleSidebar();
      });
    }
    if (ui.sidebarOverlay) {
      ui.sidebarOverlay.addEventListener("click", closeSidebarMobile);
    }

    if (ui.logoutBtn) ui.logoutBtn.addEventListener("click", logout);
    if (ui.refreshApprovalsBtn) ui.refreshApprovalsBtn.addEventListener("click", loadApprovalsIfApprover);

    if (ui.cancelRejectBtn) ui.cancelRejectBtn.addEventListener("click", closeRejectModal);
    if (ui.rejectConfirmBtn) ui.rejectConfirmBtn.addEventListener("click", onRejectConfirm);

    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && ui.rejectModal && !ui.rejectModal.classList.contains("hidden")) {
        closeRejectModal();
      }
    });
  }

  function toggleSidebar() {
    if (!state.ui.sidebar) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      state.ui.sidebar.classList.toggle("open");
    } else {
      state.ui.sidebar.classList.toggle("collapsed");
    }
  }

  function closeSidebarMobile() {
    if (state.ui.sidebar) state.ui.sidebar.classList.remove("open");
  }

  async function callApi(endpoint, options = {}) {
    if (typeof window.apiFetch === "function") {
      try {
        return await window.apiFetch(endpoint, options);
      } catch (err) {
        console.error(`API Error [${endpoint}]:`, err);
        return null;
      }
    }
    
    // Fallback logic
    try {
      const url = endpoint.startsWith("http") ? endpoint : CONFIG.API_BASE + endpoint;
      const headers = { ...options.headers };
      const token = sessionStorage.getItem(CONFIG.TOKEN_KEY) || localStorage.getItem(CONFIG.TOKEN_KEY);
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) { logout(); return null; }
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `Status ${res.status}`);
      return json;
    } catch (err) {
      console.error("Fallback API Error:", err);
      return null;
    }
  }

  function loadUserFromStorage() {
    try {
      const raw = sessionStorage.getItem(CONFIG.USER_KEY) || localStorage.getItem(CONFIG.USER_KEY);
      if (raw) state.currentUser = JSON.parse(raw);
    } catch (e) {}
  }

  async function populateUserHeader() {
    if (!state.currentUser) {
      const userData = await callApi("/api/auth/me");
      if (userData) state.currentUser = userData.user || userData;
    }

    const ui = state.ui;
    const user = state.currentUser || {};
    const name = user.name || user.email || "Guest";
    const role = (user.role || "user").toLowerCase();

    if (ui.userName) ui.userName.textContent = name;
    if (ui.userRole) {
      ui.userRole.textContent = role.toUpperCase();
      ui.userRole.className = `role-badge ${role}`;
    }
  }

  async function loadDashboardSummary() {
    const data = await callApi("/api/dashboard/summary");
    if (!data) return;

    const ui = state.ui;
    if (ui.kpiTotal) ui.kpiTotal.textContent = data.totalInvoices ?? 0;
    if (ui.kpiPending) ui.kpiPending.textContent = data.pendingApprovals ?? 0;
    if (ui.kpiApprovedValue) ui.kpiApprovedValue.textContent = formatMoney(data.approvedAmount);
    if (ui.kpiRejected) ui.kpiRejected.textContent = data.rejectedCount ?? 0;
  }

  async function loadRecentInvoices() {
    const ui = state.ui;
    if (!ui.recentInvoicesBody) return;

    toggleVisibility(ui.invoicesLoading, true);
    toggleVisibility(ui.invoicesEmpty, false);
    ui.recentInvoicesBody.innerHTML = "";

    const res = await callApi("/api/invoice/my"); // Using "my" invoices for recent list
    toggleVisibility(ui.invoicesLoading, false);
    
    // Handle { invoices: [...] } or [...] response
    const invoices = Array.isArray(res) ? res : (res?.invoices || []);
    // Limit to 5
    const recent = invoices.slice(0, 5);

    if (!recent.length) {
      toggleVisibility(ui.invoicesEmpty, true);
      return;
    }

    recent.forEach(inv => {
      const tr = document.createElement("tr");
      const status = (inv.status || "pending").toLowerCase();
      tr.innerHTML = `
        <td><a href="submit-invoice.html?id=${inv._id}" class="link">${inv.invoiceId || inv._id || "—"}</a></td>
        <td>${escapeHtml(inv.vendorName || inv.vendor)}</td>
        <td>${formatDate(inv.invoiceDate || inv.createdAt)}</td>
        <td>${formatMoney(inv.amount)}</td>
        <td><span class="status status-${status}">${status}</span></td>
      `;
      ui.recentInvoicesBody.appendChild(tr);
    });
  }

  async function loadApprovalsIfApprover() {
    const ui = state.ui;
    if (!ui.approvalsList) return;

    toggleVisibility(ui.approvalsLoading, true);
    toggleVisibility(ui.approvalsEmpty, false);
    ui.approvalsList.innerHTML = "";

    // Fetch pending approvals for current role
    const res = await callApi("/api/invoice/pending");
    const items = res?.invoices || [];

    toggleVisibility(ui.approvalsLoading, false);

    if (!items.length) {
      toggleVisibility(ui.approvalsEmpty, true);
      return;
    }

    items.forEach(inv => {
      const li = document.createElement("li");
      li.className = "approval-item";
      li.innerHTML = `
        <div class="approval-info">
          <strong>${escapeHtml(inv.vendorName || "Unknown")}</strong>
          <span class="muted small">${formatMoney(inv.amount)}</span>
        </div>
        <div class="approval-actions"></div>
      `;
      const actions = li.querySelector(".approval-actions");
      
      const approveBtn = createIconBtn("✔", "var(--success)", "Approve", () => onApprove(inv._id));
      const rejectBtn = createIconBtn("✖", "var(--danger)", "Reject", () => onRejectStart(inv._id, inv.invoiceId));
      
      actions.append(approveBtn, rejectBtn);
      ui.approvalsList.appendChild(li);
    });
  }

  async function loadActivityLog() {
    const ui = state.ui;
    if (!ui.activityList) return;
    
    // Placeholder as backend activity log endpoint might not be public
    ui.activityList.innerHTML = `<li class="muted">No recent activity.</li>`;
  }

  async function onApprove(id) {
    if (!id || !confirm("Confirm approval?")) return;
    const res = await callApi(`/api/invoice/approve/${id}`, { method: "PUT" });
    if (res) refreshAll();
  }

  function onRejectStart(dbId, displayId) {
    state.pendingRejectId = dbId;
    const ui = state.ui;
    if (ui.rejectReason) ui.rejectReason.value = "";
    if (ui.rejectError) ui.rejectError.classList.add("hidden");
    if (ui.rejectModal) {
      ui.rejectModal.classList.remove("hidden");
      ui.rejectModal.style.display = "flex";
      ui.rejectModal.setAttribute("aria-hidden", "false");
      setTimeout(() => ui.rejectReason?.focus(), 50);
    }
  }

  async function onRejectConfirm() {
    const ui = state.ui;
    const reason = ui.rejectReason.value.trim();
    if (!reason) {
      ui.rejectError.classList.remove("hidden");
      ui.rejectError.textContent = "Please enter a reason.";
      return;
    }
    if (!state.pendingRejectId) return closeRejectModal();

    ui.rejectConfirmBtn.disabled = true;
    ui.rejectConfirmBtn.textContent = "Processing...";

    const res = await callApi(`/api/invoice/reject/${state.pendingRejectId}`, {
      method: "PUT",
      body: { comment: reason } // apiFetch handles stringify
    });

    ui.rejectConfirmBtn.disabled = false;
    ui.rejectConfirmBtn.textContent = "Reject Invoice";

    if (res) {
      closeRejectModal();
      refreshAll();
    }
  }

  function closeRejectModal() {
    const ui = state.ui;
    state.pendingRejectId = null;
    if (ui.rejectModal) {
      ui.rejectModal.classList.add("hidden");
      ui.rejectModal.style.display = "none";
      ui.rejectModal.setAttribute("aria-hidden", "true");
    }
  }

  async function refreshAll() {
    await Promise.allSettled([
      loadDashboardSummary(),
      loadRecentInvoices(),
      loadApprovalsIfApprover()
    ]);
  }

  function logout() {
    sessionStorage.clear();
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    window.location.href = "login.html";
  }

  function toggleVisibility(el, visible) {
    if (!el) return;
    visible ? el.classList.remove("hidden") : el.classList.add("hidden");
  }

  function createIconBtn(html, color, title, onClick) {
    const btn = document.createElement("button");
    btn.className = "icon-btn small";
    btn.style.color = color;
    btn.innerHTML = html;
    btn.title = title;
    btn.onclick = onClick;
    return btn;
  }

  function formatMoney(amount) {
    try { return currencyFormatter.format(Number(amount || 0)); } catch (e) { return "—"; }
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  }
})();
