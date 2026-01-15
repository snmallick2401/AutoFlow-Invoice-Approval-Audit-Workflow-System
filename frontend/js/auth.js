// frontend/js/auth.js
"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const CONFIG = {
    TOKEN_KEY: "autoflow_token",
    USER_KEY: "autoflow_user",
  };

  // DOM Elements
  const ui = {
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

  if (!ui.form) return; // Exit if not on login page

  // --- Event Listeners ---

  // Password Visibility Toggle
  if (ui.togglePass) {
    ui.togglePass.addEventListener("click", (e) => {
      e.preventDefault();
      const isPass = ui.password.type === "password";
      ui.password.type = isPass ? "text" : "password";
      ui.togglePass.setAttribute("aria-label", isPass ? "Hide password" : "Show password");
    });
  }

  // Optional Theme Toggle
  if (ui.themeToggle) {
    ui.themeToggle.addEventListener("click", (e) => {
      e.preventDefault();
      const isDark = document.documentElement.classList.toggle("dark");
      localStorage.setItem("theme", isDark ? "dark" : "light");
    });
  }

  // Login Submission
  ui.form.addEventListener("submit", handleLogin);

  // --- Handlers ---

  async function handleLogin(e) {
    e.preventDefault();
    clearError();

    const email = ui.email.value.trim();
    const password = ui.password.value;

    // Validation
    if (!validateEmail(email)) {
      showError("Please enter a valid email address.");
      ui.email.focus();
      return;
    }
    if (!password || password.length < 6) {
      showError("Please enter your password (min 6 chars).");
      ui.password.focus();
      return;
    }

    setLoading(true);

    try {
      // apiFetch handles network errors and non-2xx status codes
      const data = await window.apiFetch("/api/auth/login", {
        method: "POST",
        body: { email, password }, // apiFetch handles JSON stringify
      });

      if (!data || !data.token) {
        throw new Error("Invalid response from server.");
      }

      handleLoginSuccess(data);
    } catch (err) {
      console.error("Login failed:", err);
      showError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  function handleLoginSuccess(data) {
    const { token, user } = data;

    // Storage Strategy: Local vs Session
    if (ui.remember.checked) {
      localStorage.setItem(CONFIG.TOKEN_KEY, token);
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
      // Clear session to avoid conflicts
      sessionStorage.removeItem(CONFIG.TOKEN_KEY);
      sessionStorage.removeItem(CONFIG.USER_KEY);
    } else {
      sessionStorage.setItem(CONFIG.TOKEN_KEY, token);
      sessionStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
      // Clear local to avoid conflicts
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      localStorage.removeItem(CONFIG.USER_KEY);
    }

    // Redirect
    window.location.href = "dashboard.html";
  }

  // --- UI Helpers ---

  function setLoading(active) {
    if (active) {
      ui.btn.disabled = true;
      if (ui.spinner) ui.spinner.hidden = false;
      if (ui.btnText) ui.btnText.textContent = "Signing in...";
    } else {
      ui.btn.disabled = false;
      if (ui.spinner) ui.spinner.hidden = true;
      if (ui.btnText) ui.btnText.textContent = "Sign In";
    }
  }

  function showError(msg) {
    if (ui.error) {
      ui.error.hidden = false;
      ui.error.textContent = msg;
    } else {
      alert(msg);
    }
  }

  function clearError() {
    if (ui.error) {
      ui.error.hidden = true;
      ui.error.textContent = "";
    }
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
});
