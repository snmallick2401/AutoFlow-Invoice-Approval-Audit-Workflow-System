// frontend/js/invoice.js
"use strict";

(() => {
  const CONFIG = {
    TOKEN_KEY: "autoflow_token",
    USER_KEY: "autoflow_user",
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    loadUserInfo();
    attachEventListeners();
  }

  // --- User & Layout ---

  function loadUserInfo() {
    try {
      const raw = localStorage.getItem(CONFIG.USER_KEY) || sessionStorage.getItem(CONFIG.USER_KEY);
      if (!raw) return;

      const user = JSON.parse(raw);
      const nameEl = document.getElementById("userName");
      const roleEl = document.getElementById("userRole");

      if (nameEl) nameEl.textContent = user.name || user.email || "User";
      if (roleEl) {
        roleEl.textContent = (user.role || "user").toUpperCase();
        roleEl.className = `role-badge ${user.role}`;
      }
    } catch (err) {
      console.warn("User info unavailable");
    }
  }

  function attachEventListeners() {
    // Header Actions
    document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);
    
    document.getElementById("sidebarToggle")?.addEventListener("click", (e) => {
      e.preventDefault();
      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        if (window.innerWidth < 768) sidebar.classList.toggle("open");
        else sidebar.classList.toggle("collapsed");
      }
    });

    document.getElementById("sidebarOverlay")?.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.remove("open");
    });

    // Form Action
    const form = document.getElementById("invoiceForm");
    if (form) form.addEventListener("submit", handleSubmit);
  }

  function handleLogout() {
    try {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      localStorage.removeItem(CONFIG.USER_KEY);
      sessionStorage.clear();
    } catch (e) {}
    window.location.href = "login.html";
  }

  // --- Form Submission ---

  async function handleSubmit(e) {
    e.preventDefault();
    clearMessages();

    // DOM Elements
    const vendorInput = document.getElementById("vendorName"); // Ensure ID matches HTML
    const amountInput = document.getElementById("amount");
    const dateInput = document.getElementById("invoiceDate");
    const fileInput = document.getElementById("file"); // Changed ID to generic 'file' or match HTML

    // Values
    const vendorName = vendorInput?.value.trim();
    const amount = amountInput?.value;
    const invoiceDate = dateInput?.value;
    const file = fileInput?.files[0];

    // Validation
    if (!vendorName) return showError("Vendor name is required.");
    if (!amount || Number(amount) <= 0) return showError("Amount must be greater than zero.");
    if (!invoiceDate) return showError("Invoice date is required.");
    if (!file) return showError("Invoice PDF is required.");
    if (file.type !== "application/pdf") return showError("Only PDF files are allowed.");

    setLoading(true);

    const formData = new FormData();
    formData.append("vendorName", vendorName);
    formData.append("amount", amount);
    formData.append("invoiceDate", invoiceDate);
    // IMPORTANT: Backend expects field name 'file'
    formData.append("file", file);

    try {
      // apiFetch automatically handles FormData headers
      await window.apiFetch("/api/invoice/create", {
        method: "POST",
        body: formData
      });

      showSuccess("Invoice submitted successfully.");
      
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1000);

    } catch (err) {
      console.error("Submission failed:", err);
      showError(err.message || "Failed to submit invoice.");
    } finally {
      setLoading(false);
    }
  }

  // --- UI Helpers ---

  function setLoading(isLoading) {
    const btn = document.getElementById("submitBtn");
    const text = document.getElementById("submitBtnText");
    const spinner = document.getElementById("submitSpinner");

    if (btn) btn.disabled = isLoading;
    if (spinner) spinner.hidden = !isLoading;
    if (text) text.textContent = isLoading ? "Submitting..." : "Submit Invoice";
  }

  function showError(msg) {
    const el = document.getElementById("formError");
    if (el) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      alert(msg);
    }
  }

  function showSuccess(msg) {
    const el = document.getElementById("formSuccess");
    if (el) {
      el.textContent = msg;
      el.hidden = false;
    }
  }

  function clearMessages() {
    const err = document.getElementById("formError");
    const ok = document.getElementById("formSuccess");
    if (err) { err.hidden = true; err.textContent = ""; }
    if (ok) { ok.hidden = true; ok.textContent = ""; }
  }

})();
