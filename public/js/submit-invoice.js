// backend/public/js/submit-invoice.js
"use strict";

(() => {
  const CONFIG = {
    TOKEN_KEY: "autoflow_token",
    USER_KEY: "autoflow_user",
  };

  const state = {
    currentUser: null,
    ui: {}
  };

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheDOM();
    attachEventListeners();
    loadUserFromStorage();
    await populateUserHeader();
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
      form: get("invoiceForm"),
      submitBtn: get("submitBtn")
    };
  }

  function attachEventListeners() {
    const ui = state.ui;

    if (ui.sidebarToggle) {
      ui.sidebarToggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent bubbling conflicts
        toggleSidebar();
      });
    }
    
    if (ui.sidebarOverlay) {
      ui.sidebarOverlay.addEventListener("click", closeSidebarMobile);
    }

    if (ui.logoutBtn) ui.logoutBtn.addEventListener("click", logout);

    if (ui.form) {
      ui.form.addEventListener("submit", handleSubmit);
    }
  }

  // --- Sidebar Logic ---

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

  // --- User Logic ---

  function loadUserFromStorage() {
    try {
      const raw = sessionStorage.getItem(CONFIG.USER_KEY) || localStorage.getItem(CONFIG.USER_KEY);
      if (raw) state.currentUser = JSON.parse(raw);
    } catch (e) {}
  }

  async function populateUserHeader() {
    // If we have an apiFetch wrapper, try to get fresh me data
    if (typeof window.apiFetch === "function") {
      try {
        const data = await window.apiFetch("/api/auth/me");
        if (data && (data.user || data.email)) {
          state.currentUser = data.user || data;
          // Keep storage in sync with fresh server data
          localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(state.currentUser));
        }
      } catch (e) {
        // Silently fail if 'me' endpoint isn't available, rely on storage
        console.warn("Could not fetch fresh user details:", e);
      }
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

  // --- Form Submission ---

  async function handleSubmit(e) {
    e.preventDefault();
    const ui = state.ui;
    
    // Create FormData from the form element
    const formData = new FormData(ui.form);

    // 1. Client-side Validation
    const amount = parseFloat(formData.get("amount"));
    const vendor = formData.get("vendorName");
    const date = formData.get("invoiceDate");
    const file = formData.get("file");

    if (!vendor) return alert("Vendor name is required.");
    if (isNaN(amount) || amount <= 0) return alert("Please enter a valid positive amount.");
    if (!date) return alert("Invoice date is required.");
    
    if (!file || file.size === 0) {
      return alert("Please attach a valid invoice PDF.");
    }
    // Simple MIME check
    if (file.type !== "application/pdf") {
      return alert("Only PDF files are allowed.");
    }

    // 2. UI Loading State
    const originalBtnText = ui.submitBtn.textContent;
    ui.submitBtn.disabled = true;
    ui.submitBtn.textContent = "Submitting...";

    try {
      if (typeof window.apiFetch !== "function") {
        throw new Error("API client not initialized (apiFetch missing).");
      }

      // apiFetch handles Authorization headers automatically
      await window.apiFetch("/api/invoice/create", {
        method: "POST",
        body: formData
      });

      alert("Invoice submitted successfully!");
      
      // Redirect to dashboard
      window.location.href = "dashboard.html";

    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to submit invoice. Please try again.");
      
      // Reset UI
      ui.submitBtn.disabled = false;
      ui.submitBtn.textContent = originalBtnText;
    }
  }

  function logout() {
    sessionStorage.clear();
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    // Updated redirect: login.html -> index.html
    window.location.href = "index.html";
  }

})();
