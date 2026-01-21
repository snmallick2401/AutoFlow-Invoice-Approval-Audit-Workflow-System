// backend/public/js/auth.js
"use strict";

(() => {
  // --- Configuration ---
  const CONFIG = {
    TOKEN_KEY: "autoflow_token",
    USER_KEY: "autoflow_user",
    THEME_KEY: "theme",
    DASHBOARD_URL: "dashboard.html",
  };

  // --- State ---
  const state = {
    isSubmitting: false,
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const ui = cacheDOM();
    if (!ui.form) return; // Exit if not on login page

    bindEvents(ui);
    checkRedirect(); // Optional: Check if already logged in
  }

  // --- DOM Caching ---
  function cacheDOM() {
    return {
      form: document.getElementById("loginForm"),
      email: document.getElementById("email"),
      password: document.getElementById("password"),
      remember: document.getElementById("remember"),
      btn: document.getElementById("loginBtn"),
      btnText: document.getElementById("loginBtnText"),
      spinner: document.getElementById("loginSpinner"),
      error: document.getElementById("loginError"),
      togglePass: document.getElementById("togglePassword"),
      themeToggle: document.getElementById("themeToggle"),
    };
  }

  // --- Event Binding ---
  function bindEvents(ui) {
    // Login Submission
    ui.form.addEventListener("submit", (e) => handleLogin(e, ui));

    // Password Visibility Toggle
    if (ui.togglePass) {
      ui.togglePass.addEventListener("click", (e) => {
        e.preventDefault();
        togglePasswordVisibility(ui);
      });
    }

    // Theme Toggle (Specific to Login Page)
    if (ui.themeToggle) {
      ui.themeToggle.addEventListener("click", (e) => {
        e.preventDefault();
        const isDark = document.documentElement.classList.toggle("dark");
        localStorage.setItem(CONFIG.THEME_KEY, isDark ? "dark" : "light");
      });
    }
  }

  // --- Core Handlers ---

  async function handleLogin(e, ui) {
    e.preventDefault();
    if (state.isSubmitting) return; // Prevent double-submit

    clearError(ui);

    const email = ui.email.value.trim();
    const password = ui.password.value;

    // 1. Validation
    if (!validateEmail(email)) {
      showError(ui, "Please enter a valid email address.");
      ui.email.focus();
      return;
    }
    if (!password) {
      showError(ui, "Please enter your password.");
      ui.password.focus();
      return;
    }

    // 2. Submit
    setLoading(ui, true);

    try {
      // Ensure API client is loaded
      if (typeof window.apiFetch !== "function") {
        throw new Error("System error: API client not initialized.");
      }

      const response = await window.apiFetch("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      if (!response || !response.token) {
        throw new Error("Invalid response from server.");
      }

      processLoginSuccess(response, ui.remember.checked);

    } catch (err) {
      console.error("Login Error:", err);
      
      // User-friendly error mapping
      let msg = "Login failed. Please check your credentials.";
      if (err.status === 401) msg = "Invalid email or password.";
      else if (err.message) msg = err.message;

      showError(ui, msg);
    } finally {
      setLoading(ui, false);
    }
  }

  function processLoginSuccess(data, rememberMe) {
    const { token, user } = data;

    // 1. Clean Slate: Clear ALL storage to prevent conflicts
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    sessionStorage.removeItem(CONFIG.TOKEN_KEY);
    sessionStorage.removeItem(CONFIG.USER_KEY);

    // 2. Store New Session
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(CONFIG.TOKEN_KEY, token);
    storage.setItem(CONFIG.USER_KEY, JSON.stringify(user));

    // 3. Redirect
    window.location.href = CONFIG.DASHBOARD_URL;
  }

  // --- Helper Functions ---

  function togglePasswordVisibility(ui) {
    const isPassword = ui.password.type === "password";
    ui.password.type = isPassword ? "text" : "password";
    
    // Update ARIA for accessibility
    ui.togglePass.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
    
    // Optional: If using an icon class toggle
    // ui.togglePass.classList.toggle("active"); 
  }

  function setLoading(ui, isLoading) {
    state.isSubmitting = isLoading;
    ui.btn.disabled = isLoading;
    
    if (ui.spinner) ui.spinner.hidden = !isLoading;
    
    if (ui.btnText) {
      ui.btnText.textContent = isLoading ? "Signing in..." : "Sign In";
    }
  }

  function showError(ui, msg) {
    if (ui.error) {
      ui.error.textContent = msg;
      ui.error.hidden = false;
      // Optional visual shake
      ui.error.classList.remove("hidden");
    } else {
      alert(msg);
    }
  }

  function clearError(ui) {
    if (ui.error) {
      ui.error.textContent = "";
      ui.error.hidden = true;
    }
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function checkRedirect() {
    // If user is already logged in, you might want to auto-redirect
    // Uncomment below if desired:
    /*
    const token = localStorage.getItem(CONFIG.TOKEN_KEY) || sessionStorage.getItem(CONFIG.TOKEN_KEY);
    if (token) {
      window.location.href = CONFIG.DASHBOARD_URL;
    }
    */
  }

})();
