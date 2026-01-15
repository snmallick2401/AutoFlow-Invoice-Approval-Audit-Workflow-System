// frontend/js/submit-invoice.js
"use strict";

(() => {
  const CONFIG = {
    TOKEN_KEY: "autoflow_token",
    USER_KEY: "autoflow_user",
    API_BASE: (typeof window.API_BASE_URL === "string") ? window.API_BASE_URL : "http://localhost:5000"
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

  function loadUserFromStorage() {
    try {
      const raw = sessionStorage.getItem(CONFIG.USER_KEY) || localStorage.getItem(CONFIG.USER_KEY);
      if (raw) state.currentUser = JSON.parse(raw);
    } catch (e) {}
  }

  async function populateUserHeader() {
    if (!state.currentUser && typeof window.apiFetch === "function") {
      try {
        const data = await window.apiFetch("/api/auth/me");
        if (data) state.currentUser = data.user || data;
      } catch (e) {}
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

  async function handleSubmit(e) {
    e.preventDefault();
    const ui = state.ui;
    const formData = new FormData(ui.form);

    // Validation
    const amount = parseFloat(formData.get("amount"));
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const file = formData.get("file");
    if (!file || file.size === 0) {
      alert("Please attach a valid invoice PDF.");
      return;
    }

    ui.submitBtn.disabled = true;
    ui.submitBtn.textContent = "Submitting...";

    try {
      // Use apiFetch if available (handles auth automatically)
      if (typeof window.apiFetch === "function") {
        await window.apiFetch("/api/invoice/create", {
          method: "POST",
          body: formData
        });
      } else {
        // Fallback fetch logic
        const token = sessionStorage.getItem(CONFIG.TOKEN_KEY) || localStorage.getItem(CONFIG.TOKEN_KEY);
        const headers = {}; 
        if (token) headers["Authorization"] = `Bearer ${token}`;
        
        const res = await fetch(CONFIG.API_BASE + "/api/invoice/create", {
          method: "POST",
          headers, // Do NOT set Content-Type for FormData
          body: formData
        });
        
        if (!res.ok) throw new Error(`Error ${res.status}`);
      }

      alert("Invoice submitted successfully!");
      window.location.href = "dashboard.html";

    } catch (err) {
      console.error(err);
      alert("Failed to submit invoice. Please try again.");
      ui.submitBtn.disabled = false;
      ui.submitBtn.textContent = "Submit Invoice";
    }
  }

  function logout() {
    sessionStorage.clear();
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    window.location.href = "login.html";
  }

})();
