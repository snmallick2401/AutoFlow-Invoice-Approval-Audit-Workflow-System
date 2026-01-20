// backend/public/js/audit-logs.js
"use strict";

(() => {
  const CONFIG = {
    USER_KEY: "autoflow_user",
  };

  const state = {
    page: 1,
    limit: 15,
    totalPages: 1,
    logs: [] // Store current page logs here for safe access
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    loadUser();
    attachListeners();
    fetchLogs();
  }

  // --- UI & Listeners ---

  function loadUser() {
    try {
      const user = JSON.parse(sessionStorage.getItem(CONFIG.USER_KEY) || localStorage.getItem(CONFIG.USER_KEY));
      if (user) {
        document.getElementById("userName").textContent = user.name || "Admin";
        const badge = document.getElementById("userRole");
        badge.textContent = (user.role || "ADMIN").toUpperCase();
        badge.className = `role-badge ${user.role}`;
      }
    } catch (e) {}
  }

  function attachListeners() {
    // Sidebar Toggle
    document.getElementById("sidebarToggle")?.addEventListener("click", (e) => {
      e.preventDefault();
      const sb = document.getElementById("sidebar");
      if (window.innerWidth < 768) sb.classList.toggle("open");
      else sb.classList.toggle("collapsed");
    });

    document.getElementById("sidebarOverlay")?.addEventListener("click", () => {
      document.getElementById("sidebar").classList.remove("open");
    });

    // Auth
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      sessionStorage.clear();
      localStorage.clear();
      // Redirect to index.html (Deployment standard)
      window.location.href = "index.html"; 
    });

    // Filters
    document.getElementById("auditFilterForm").addEventListener("submit", (e) => {
      e.preventDefault();
      state.page = 1; // Reset to page 1 on filter
      fetchLogs();
    });

    // Pagination
    document.getElementById("prevPage").addEventListener("click", () => changePage(-1));
    document.getElementById("nextPage").addEventListener("click", () => changePage(1));

    // Modal Close
    document.getElementById("closeMetaBtn").addEventListener("click", () => {
      document.getElementById("metaModal").classList.add("hidden");
    });

    // Event Delegation for "View Details" buttons
    document.getElementById("auditTableBody").addEventListener("click", (e) => {
      if (e.target.matches(".view-meta-btn")) {
        const index = e.target.getAttribute("data-index");
        const logData = state.logs[index];
        if (logData && logData.metadata) {
          openMetaModal(logData.metadata);
        }
      }
    });
  }

  function changePage(delta) {
    const newPage = state.page + delta;
    if (newPage > 0 && newPage <= state.totalPages) {
      state.page = newPage;
      fetchLogs();
    }
  }

  // --- Data Fetching ---

  async function fetchLogs() {
    const action = document.getElementById("filterAction").value;
    const date = document.getElementById("filterDate").value;
    
    const loading = document.getElementById("tableLoading");
    const empty = document.getElementById("tableEmpty");
    const tbody = document.getElementById("auditTableBody");

    // UI Loading State
    tbody.innerHTML = "";
    loading.classList.remove("hidden");
    empty.classList.add("hidden");
    updatePaginationUI();

    try {
      // Build Query
      const params = new URLSearchParams({
        page: state.page,
        limit: state.limit
      });
      if (action) params.append("action", action);
      if (date) params.append("date", date);

      const res = await window.apiFetch(`/api/audit?${params.toString()}`);
      
      loading.classList.add("hidden");
      
      if (!res.logs || res.logs.length === 0) {
        state.logs = [];
        empty.classList.remove("hidden");
        state.totalPages = 1;
        updatePaginationUI();
        return;
      }

      state.logs = res.logs; // Store data for modal usage
      state.totalPages = res.pages;
      renderTable(res.logs);
      updatePaginationUI();

    } catch (err) {
      console.error("Audit fetch failed:", err);
      loading.textContent = "Failed to load logs. You might not have permission.";
    }
  }

  function renderTable(logs) {
    const tbody = document.getElementById("auditTableBody");
    const frag = document.createDocumentFragment();

    logs.forEach((log, index) => {
      const tr = document.createElement("tr");
      
      const actor = log.userId 
        ? `<span style="font-weight:500">${escapeHtml(log.userId.name || log.userId.email)}</span>` 
        : `<span class="muted">System / Unknown</span>`;

      const resource = log.resource 
        ? `<small class="muted">${log.resource.type}: ${log.resource.id}</small>` 
        : `<small class="muted">-</small>`;

      // Improved Button: Uses data-index instead of passing raw JSON string
      const metaBtn = `<button class="btn neutral small view-meta-btn" data-index="${index}">View</button>`;

      tr.innerHTML = `
        <td style="white-space:nowrap; font-size:0.8rem;">
          ${new Date(log.timestamp).toLocaleString()}
        </td>
        <td><span class="status" style="background:var(--bg); border:1px solid var(--border);">${log.action}</span></td>
        <td>${actor}</td>
        <td>${log.ip || "—"}</td>
        <td>${resource}</td>
        <td style="text-align:right;">${log.metadata ? metaBtn : '<span class="muted">—</span>'}</td>
      `;
      frag.appendChild(tr);
    });

    tbody.appendChild(frag);
  }

  function updatePaginationUI() {
    const prev = document.getElementById("prevPage");
    const next = document.getElementById("nextPage");
    
    prev.disabled = state.page <= 1;
    next.disabled = state.page >= state.totalPages;
  }

  function openMetaModal(meta) {
    const modal = document.getElementById("metaModal");
    const content = document.getElementById("metaContent");
    
    content.textContent = JSON.stringify(meta, null, 2);
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }

  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, m => ({ 
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' 
    })[m]);
  }

})();
