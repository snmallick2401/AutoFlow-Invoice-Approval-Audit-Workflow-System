// backend/public/js/reports.js
"use strict";

(() => {
  const CONFIG = {
    USER_KEY: "autoflow_user",
  };

  const state = {
    charts: { spending: null, status: null }
  };

  // Formatter for currency (INR)
  const currencyFormatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    loadUser();
    attachListeners();
    // Default: Load last 30 days
    setDefaultDates();
    fetchReportData();
  }

  // --- UI & Listeners ---

  function loadUser() {
    try {
      const raw = sessionStorage.getItem(CONFIG.USER_KEY) || localStorage.getItem(CONFIG.USER_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        const nameEl = document.getElementById("userName");
        const roleEl = document.getElementById("userRole");

        if (nameEl) nameEl.textContent = user.name || "User";
        if (roleEl) {
          roleEl.textContent = (user.role || "").toUpperCase();
          roleEl.className = `role-badge ${user.role}`;
        }
      }
    } catch (e) {
      console.warn("Failed to load user info:", e);
    }
  }

  function attachListeners() {
    // Sidebar Toggles
    document.getElementById("sidebarToggle")?.addEventListener("click", (e) => {
      e.preventDefault();
      const sb = document.getElementById("sidebar");
      if (window.innerWidth < 768) sb.classList.toggle("open");
      else sb.classList.toggle("collapsed");
    });

    document.getElementById("sidebarOverlay")?.addEventListener("click", () => {
      document.getElementById("sidebar").classList.remove("open");
    });

    // Logout
    document.getElementById("logoutBtn")?.addEventListener("click", () => {
      sessionStorage.clear();
      localStorage.clear();
      window.location.href = "index.html"; // Changed from login.html to index.html for deployment
    });

    // Filter Form
    const filterForm = document.getElementById("reportFilterForm");
    if (filterForm) {
      filterForm.addEventListener("submit", (e) => {
        e.preventDefault();
        fetchReportData();
      });
    }

    // Export Button
    document.getElementById("exportBtn")?.addEventListener("click", exportCSV);
  }

  function setDefaultDates() {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1); // Last 30 days default

    const endEl = document.getElementById("endDate");
    const startEl = document.getElementById("startDate");

    if (endEl) endEl.valueAsDate = end;
    if (startEl) startEl.valueAsDate = start;
  }

  // --- Data Fetching ---

  async function fetchReportData() {
    const startInput = document.getElementById("startDate");
    const endInput = document.getElementById("endDate");
    const loading = document.getElementById("tableLoading");
    const empty = document.getElementById("tableEmpty");
    const tbody = document.getElementById("reportTableBody");

    if (!tbody) return;

    // Reset UI
    tbody.innerHTML = "";
    if (loading) loading.classList.remove("hidden");
    if (empty) empty.classList.add("hidden");

    const start = startInput ? startInput.value : "";
    const end = endInput ? endInput.value : "";

    try {
      const query = `?startDate=${start}&endDate=${end}`;
      // Call Backend
      const data = await window.apiFetch(`/api/reports/analytics${query}`);

      if (loading) loading.classList.add("hidden");
      
      // Handle empty data
      if (!data || !data.invoices || data.invoices.length === 0) {
        if (empty) empty.classList.remove("hidden");
        // Clear charts if empty
        if(state.charts.spending) state.charts.spending.destroy();
        if(state.charts.status) state.charts.status.destroy();
        return;
      }

      renderCharts(data);
      renderTable(data.invoices);

    } catch (err) {
      console.error("Report fetch error:", err);
      if (loading) loading.textContent = "Failed to load report data.";
    }
  }

  function renderCharts(data) {
    if (typeof Chart === "undefined") return;

    const ctxSpending = document.getElementById("spendingChart")?.getContext("2d");
    const ctxStatus = document.getElementById("statusChart")?.getContext("2d");

    if (!ctxSpending || !ctxStatus) return;

    // 1. Spending Chart (Bar)
    if (state.charts.spending) state.charts.spending.destroy();
    
    state.charts.spending = new Chart(ctxSpending, {
      type: 'bar',
      data: {
        labels: data.monthlyStats.map(item => item._id), // e.g. "2023-10"
        datasets: [{
          label: 'Total Spending (INR)',
          data: data.monthlyStats.map(item => item.totalAmount),
          backgroundColor: '#4f46e5',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    // 2. Status Chart (Doughnut)
    if (state.charts.status) state.charts.status.destroy();

    const statusLabels = data.statusStats.map(s => (s._id || "Unknown").toUpperCase());
    const statusValues = data.statusStats.map(s => s.count);
    
    // Assign specific colors to statuses
    const statusColors = data.statusStats.map(s => {
      const id = (s._id || "").toLowerCase();
      if(id === 'approved') return '#16a34a'; // Green
      if(id === 'rejected') return '#dc2626'; // Red
      return '#f59e0b'; // Amber (Pending)
    });

    state.charts.status = new Chart(ctxStatus, {
      type: 'doughnut',
      data: {
        labels: statusLabels,
        datasets: [{
          data: statusValues,
          backgroundColor: statusColors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%'
      }
    });
  }

  function renderTable(invoices) {
    const tbody = document.getElementById("reportTableBody");
    if (!tbody) return;

    const frag = document.createDocumentFragment();

    invoices.forEach(inv => {
      const tr = document.createElement("tr");
      const status = (inv.status || "pending").toLowerCase();
      
      // Use invoiceId if available, fallback to shortened _id
      const displayId = inv.invoiceId || (inv._id ? inv._id.substring(0,8) : "N/A");
      
      tr.innerHTML = `
        <td style="font-family: monospace;">${escapeHtml(displayId)}</td>
        <td>${escapeHtml(inv.vendorName)}</td>
        <td>${new Date(inv.invoiceDate).toLocaleDateString()}</td>
        <td><span class="status status-${status}">${status.toUpperCase()}</span></td>
        <td style="text-align:right;">${currencyFormatter.format(inv.amount)}</td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  function exportCSV() {
    // Simple client-side export based on current table data
    const rows = [];
    rows.push(["Invoice ID", "Vendor", "Date", "Status", "Amount"]);

    const tableRows = document.querySelectorAll("#reportTableBody tr");
    if(tableRows.length === 0) return alert("No data to export.");

    tableRows.forEach(tr => {
      const cols = tr.querySelectorAll("td");
      if (cols.length >= 5) {
        rows.push([
          cols[0].innerText, // ID
          cols[1].innerText, // Vendor
          cols[2].innerText, // Date
          cols[3].innerText, // Status
          cols[4].innerText.replace(/[^0-9.-]+/g,"") // Clean currency (remove ₹/,)
        ]);
      }
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `autoflow_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- Helpers ---

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, m => ({ 
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' 
    })[m]);
  }

})();
