// frontend/js/api.js
"use strict";

(() => {
  const CONFIG = {
    TOKEN_KEY: "autoflow_token",
    USER_KEY: "autoflow_user",
    // In production, relative paths work best. Localhost fallback included.
    API_BASE: typeof window.API_BASE_URL === "string" ? window.API_BASE_URL : "",
  };

  /**
   * Primary API Fetch Wrapper
   * Handles Headers, Auth, JSON Parsing, and Error Throwing
   */
  async function apiFetch(endpoint, options = {}) {
    const url = CONFIG.API_BASE + endpoint;
    const opts = buildOptions(options);

    let res;
    try {
      res = await fetch(url, opts);
    } catch (err) {
      console.error("[apiFetch] Network error:", err);
      throw new Error("Unable to connect to server. Please check your connection.");
    }

    // Attempt to parse JSON (safely handle empty responses)
    let data = null;
    try {
      if (res.status !== 204) {
        data = await res.json();
      }
    } catch (_) {
      // Response was not JSON, ignore body
      data = null;
    }

    // 1. Handle Auth Errors (401) - Force Logout
    if (res.status === 401) {
      // Don't redirect if we are already trying to login
      if (!endpoint.includes("/auth/login")) {
        handleUnauthorized();
      }
      const msg = data && data.message ? data.message : "Session expired. Please login again.";
      const err = new Error(msg);
      err.status = 401;
      throw err;
    }

    // 2. Handle Logic Errors (4xx, 5xx)
    if (!res.ok) {
      const msg = data && data.message ? data.message : `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    return data;
  }

  /**
   * Safe wrapper that returns null instead of throwing (optional use)
   */
  async function callApi(endpoint, options = {}) {
    try {
      return await apiFetch(endpoint, options);
    } catch (err) {
      console.warn("[callApi] Suppressed Error:", err.message);
      return null;
    }
  }

  /**
   * Helper: Construct Fetch Options
   */
  function buildOptions(options = {}) {
    const opts = { ...options };
    opts.headers = { ...options.headers };

    // Inject JWT Token
    const token = getToken();
    if (token) {
      opts.headers["Authorization"] = `Bearer ${token}`;
    }

    // Auto-detect JSON content
    // Note: Do NOT set Content-Type if body is FormData (browser does it automatically)
    if (opts.body && !(opts.body instanceof FormData)) {
      if (!hasContentType(opts.headers)) {
        opts.headers["Content-Type"] = "application/json";
      }

      if (
        opts.headers["Content-Type"] === "application/json" &&
        typeof opts.body === "object"
      ) {
        opts.body = JSON.stringify(opts.body);
      }
    }

    return opts;
  }

  function hasContentType(headers) {
    return Object.keys(headers).some((k) => k.toLowerCase() === "content-type");
  }

  function getToken() {
    return sessionStorage.getItem(CONFIG.TOKEN_KEY) || localStorage.getItem(CONFIG.TOKEN_KEY);
  }

  /**
   * Handle Logout / Session Expiry
   * Updated to point to index.html (the deployment standard)
   */
  function handleUnauthorized() {
    try {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      localStorage.removeItem(CONFIG.USER_KEY);
      sessionStorage.clear();
    } catch (_) {}

    // Check against both login.html (dev) and index.html (prod/root)
    const path = window.location.pathname;
    const isLoginPage = path.includes("login.html") || path === "/" || path.includes("index.html");

    // Only redirect if we aren't already on the login page
    // (This prevents infinite loops if the login API returns 401)
    if (!isLoginPage) {
      window.location.href = "index.html"; 
    }
  }

  // Export to global scope
  window.apiFetch = apiFetch;
  window.callApi = callApi;
})();
