// frontend/js/approvals.js
"use strict";

(() => {
  const CONFIG = {
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
    await loadUser();
    fetchInvoices();
  }

  function cacheDOM() {
    const get = (id) => document.getElementById(id);
    state.ui = {
      userName: get("userName"),
      userRole: get("userRole"),
      sidebar: get("sidebar"),
      sidebarToggle: get("sidebarToggle"),
      sidebarOverlay: get("sidebarOverlay"),
      logoutBtn: get("logoutBtn"),
      
      // Filters
      filterForm: get("filterForm"),
      filterStatus: get("filterStatus"),
      filterDate: get("filterDate"),
      refreshBtn: get("refreshBtn"),

      // Table
      tableBody: get("approvalsTableBody"),
      tableLoading: get("tableLoading"),
      tableEmpty: get("tableEmpty"),

      // Modal
      rejectModal: get("rejectModal"),
      rejectInvoiceId: get("rejectInvoiceId"),
      rejectReason: get("rejectReason"),
      rejectError: get("rejectError"),
      confirmRejectBtn: get("confirmRejectBtn"),
      cancelRejectBtn: get("cancelRejectBtn"),
    };
  }

  function attachEventListeners() {
    const ui = state.ui;

    // Navigation
    if (ui.sidebarToggle) {
      ui.sidebarToggle.addEventListener("click", () => {
        const isMobile = window.innerWidth < 768;
        if (isMobile) ui.sidebar.classList.toggle("open");
        else ui.sidebar.classList.toggle("collapsed");
      });
    }
    if (ui.sidebarOverlay) {
      ui.sidebarOverlay.addEventListener("click", () => ui.sidebar.classList.remove("open"));
    }
    if (ui.logoutBtn) ui.logoutBtn.addEventListener("click", logout);

    // Filters
    if (ui.filterForm) {
      ui.filterForm.addEventListener("submit", (e) => {
        e.preventDefault();
        fetchInvoices();
      });
    }
    if (ui.refreshBtn) ui.refreshBtn.addEventListener("click", fetchInvoices);

    // Modal
    if (ui.cancelRejectBtn) ui.cancelRejectBtn.addEventListener("click", closeRejectModal);
    if (ui.confirmRejectBtn) ui.confirmRejectBtn.addEventListener("click", handleRejectConfirm);
  }

  async function loadUser() {
    try {
      const stored = sessionStorage.getItem(CONFIG.USER_KEY) || localStorage.getItem(CONFIG.USER_KEY);
      if (stored) {
        state.currentUser = JSON.parse(stored);
      } else {
        const data = await window.apiFetch("/api/auth/me");
        state.currentUser = data;
      }
      
      if (state.currentUser && state.ui.userName) {
        state.ui.userName.textContent = state.currentUser.name || state.currentUser.email;
        state.ui.userRole.textContent = (state.currentUser.role || "user").toUpperCase();
        state.ui.userRole.className = `role-badge ${state.currentUser.role}`;
      }
    } catch (e) {
      console.warn("User load failed", e);
    }
  }

  async function fetchInvoices() {
    const ui = state.ui;
    
    ui.tableBody.innerHTML = "";
    ui.tableLoading.classList.remove("hidden");
    ui.tableEmpty.classList.add("hidden");

    try {
      const status = ui.filterStatus ? ui.filterStatus.value : "pending";
      const date = ui.filterDate ? ui.filterDate.value : "";
      
      // Construct endpoint based on filter state
      // Default to pending workflow, switch to general search if status is not pending
      let endpoint = "/api/invoice/pending";
      const params = new URLSearchParams();
      
      if (status !== "pending") {
         // Fallback logic if backend supports history lookup
         // endpoint = "/api/invoice/all"; 
      }

      if (date) params.append("date", date);
      
      const url = `${endpoint}?${params.toString()}`;
      const data = await window.apiFetch(url);

      // Backend returns { invoices: [...] }
      renderTable(data.invoices || []);
    } catch (err) {
      console.error("Fetch error:", err);
      ui.tableLoading.textContent = "Error loading data.";
    }
  }

  function renderTable(invoices) {
    const ui = state.ui;
    ui.tableLoading.classList.add("hidden");

    if (!Array.isArray(invoices) || invoices.length === 0) {
      ui.tableEmpty.classList.remove("hidden");
      return;
    }

    const fragment = document.createDocumentFragment();

    invoices.forEach(inv => {
      const tr = document.createElement("tr");
      const status = (inv.status || "pending").toLowerCase();
      const idDisplay = inv.invoiceId || inv._id;
      
      let actionsHtml = `<span class="muted">-</span>`;
      
      if (status === "pending") {
        actionsHtml = `
          <button class="icon-btn small" title="Approve" style="color:var(--success)" onclick="window.handleApprove('${inv._id}')">✔</button>
          <button class="icon-btn small" title="Reject" style="color:var(--danger)" onclick="window.handleRejectStart('${inv._id}', '${idDisplay}')">✖</button>
        `;
      }

      tr.innerHTML = `
        <td><span class="link">${idDisplay}</span></td>
        <td>${escapeHtml(inv.vendorName || inv.vendor)}</td>
        <td>${currencyFormatter.format(inv.amount)}</td>
        <td>${new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString()}</td>
        <td><span class="status status-${status}">${status}</span></td>
        <td style="text-align:right; white-space:nowrap;">${actionsHtml}</td>
      `;
      fragment.appendChild(tr);
    });

    ui.tableBody.appendChild(fragment);
  }

  // --- Window Actions (Exposed for HTML onclick) ---

  window.handleApprove = async (id) => {
    if (!confirm("Approve this invoice?")) return;
    try {
      // apiFetch handles errors
      await window.apiFetch(`/api/invoice/approve/${id}`, { method: "PUT" });
      fetchInvoices();
    } catch (e) {
      alert(e.message);
    }
  };

  window.handleRejectStart = (dbId, displayId) => {
    state.pendingRejectId = dbId;
    state.ui.rejectInvoiceId.textContent = displayId;
    state.ui.rejectReason.value = "";
    state.ui.rejectError.classList.add("hidden");
    state.ui.rejectModal.classList.remove("hidden");
    state.ui.rejectModal.style.display = "flex";
  };

  async function handleRejectConfirm() {
    const ui = state.ui;
    const reason = ui.rejectReason.value.trim();
    
    if (!reason) {
      ui.rejectError.classList.remove("hidden");
      return;
    }

    try {
      ui.confirmRejectBtn.disabled = true;
      
      // apiFetch automatically handles JSON content-type and stringify
      await window.apiFetch(`/api/invoice/reject/${state.pendingRejectId}`, {
        method: "PUT",
        body: { comment: reason }
      });

      closeRejectModal();
      fetchInvoices();
    } catch (e) {
      alert(e.message);
    } finally {
      ui.confirmRejectBtn.disabled = false;
    }
  }

  function closeRejectModal() {
    state.ui.rejectModal.classList.add("hidden");
    state.ui.rejectModal.style.display = "none";
    state.pendingRejectId = null;
  }

  function logout() {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = "login.html";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

})();
