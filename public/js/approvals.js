// backend/public/js/approvals.js
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
      // User Info
      userName: get("userName"),
      userRole: get("userRole"),
      
      // Sidebar
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

    // --- Sidebar & Navigation ---
    if (ui.sidebarToggle) {
      ui.sidebarToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Toggle based on screen size logic
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          ui.sidebar.classList.toggle("open");
        } else {
          ui.sidebar.classList.toggle("collapsed");
        }
      });
    }
    
    if (ui.sidebarOverlay) {
      ui.sidebarOverlay.addEventListener("click", () => {
        if (ui.sidebar) ui.sidebar.classList.remove("open");
      });
    }

    if (ui.logoutBtn) ui.logoutBtn.addEventListener("click", logout);

    // --- Filters & Refresh ---
    if (ui.filterForm) {
      ui.filterForm.addEventListener("submit", (e) => {
        e.preventDefault();
        fetchInvoices();
      });
    }
    if (ui.refreshBtn) ui.refreshBtn.addEventListener("click", fetchInvoices);

    // --- Modal Actions ---
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
        // Safe check if data is wrapped in { user: ... } or returned directly
        state.currentUser = data.user || data; 
      }
      
      updateUserUI();
    } catch (e) {
      console.warn("User load failed", e);
    }
  }

  function updateUserUI() {
    if (state.currentUser && state.ui.userName) {
      state.ui.userName.textContent = state.currentUser.name || state.currentUser.email;
      if (state.ui.userRole) {
        state.ui.userRole.textContent = (state.currentUser.role || "user").toUpperCase();
        state.ui.userRole.className = `role-badge ${state.currentUser.role}`;
      }
    }
  }

  // --- Core Data Logic ---

  async function fetchInvoices() {
    const ui = state.ui;
    
    ui.tableBody.innerHTML = "";
    ui.tableLoading.classList.remove("hidden");
    ui.tableEmpty.classList.add("hidden");

    try {
      const status = ui.filterStatus ? ui.filterStatus.value : "pending";
      const date = ui.filterDate ? ui.filterDate.value : "";
      
      // Build Query Parameters
      const params = new URLSearchParams();
      if (status && status !== 'all') {
        params.append("status", status);
      }
      if (date) {
        params.append("startDate", date);
        // Note: Backend 'getInvoices' uses startDate to filter >= that date
      }

      // Endpoint matches: GET /api/invoice?status=pending
      const endpoint = `/api/invoice?${params.toString()}`;
      const data = await window.apiFetch(endpoint);

      // Render
      renderTable(data.invoices || []);

    } catch (err) {
      console.error("Fetch error:", err);
      ui.tableLoading.textContent = "Failed to load invoices. " + (err.message || "");
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
    const baseUrl = window.API_BASE_URL || "";

    invoices.forEach(inv => {
      const tr = document.createElement("tr");
      const status = (inv.status || "pending").toLowerCase();
      // Use custom Invoice ID if available, otherwise DB ID
      const displayId = inv.invoiceId || inv._id; 
      
      // Dynamic Actions Column
      let actionsHtml = "";
      
      if (status === "pending") {
        actionsHtml = `
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="icon-btn small" title="Approve" style="color:var(--success)" 
              onclick="window.handleApprove('${inv.invoiceId || inv._id}')">
              ✔
            </button>
            <button class="icon-btn small" title="Reject" style="color:var(--danger)" 
              onclick="window.handleRejectStart('${inv.invoiceId || inv._id}')">
              ✖
            </button>
            <a href="${baseUrl}/${inv.filePath}" target="_blank" class="icon-btn small" title="View PDF">
              📄
            </a>
          </div>
        `;
      } else {
        actionsHtml = `
          <div style="text-align: right;">
            <a href="${baseUrl}/${inv.filePath}" target="_blank" class="icon-btn small" title="View PDF">
              📄
            </a>
          </div>
        `;
      }

      tr.innerHTML = `
        <td style="font-weight: 600;">${displayId}</td>
        <td>
          <div>${escapeHtml(inv.vendorName)}</div>
          <div style="font-size: 0.75rem; color: var(--muted);">
            By: ${inv.submittedBy?.name || 'Unknown'}
          </div>
        </td>
        <td>${currencyFormatter.format(inv.amount)}</td>
        <td>${new Date(inv.invoiceDate).toLocaleDateString()}</td>
        <td><span class="status status-${status}">${status.toUpperCase()}</span></td>
        <td>${actionsHtml}</td>
      `;
      fragment.appendChild(tr);
    });

    ui.tableBody.appendChild(fragment);
  }

  // --- Global Actions (Exposed to Window for HTML OnClick) ---

  window.handleApprove = async (id) => {
    if (!confirm(`Approve invoice ${id}?`)) return;
    
    try {
      // Calls PUT /api/invoice/:id/status
      await window.apiFetch(`/api/invoice/${id}/status`, { 
        method: "PUT",
        body: { status: "APPROVED" }
      });
      
      alert("Invoice Approved!");
      fetchInvoices(); // Refresh
    } catch (e) {
      alert(e.message || "Approval failed");
    }
  };

  window.handleRejectStart = (id) => {
    state.pendingRejectId = id;
    const ui = state.ui;
    
    // Reset and show modal
    ui.rejectInvoiceId.textContent = id;
    ui.rejectReason.value = "";
    ui.rejectError.classList.add("hidden");
    
    ui.rejectModal.classList.remove("hidden");
    ui.rejectModal.style.display = "flex";
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
      ui.confirmRejectBtn.textContent = "Processing...";

      await window.apiFetch(`/api/invoice/${state.pendingRejectId}/status`, {
        method: "PUT",
        body: { 
          status: "REJECTED",
          reason: reason 
        }
      });

      alert("Invoice Rejected.");
      closeRejectModal();
      fetchInvoices();
    } catch (e) {
      alert(e.message || "Rejection failed");
    } finally {
      ui.confirmRejectBtn.disabled = false;
      ui.confirmRejectBtn.textContent = "Reject Invoice";
    }
  }

  function closeRejectModal() {
    const modal = state.ui.rejectModal;
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
    state.pendingRejectId = null;
  }

  function logout() {
    sessionStorage.clear();
    localStorage.clear();
    // Use index.html for deployment compatibility
    window.location.href = "index.html";
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

})();
