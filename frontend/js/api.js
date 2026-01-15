// frontend/js/api.js
"use strict";

(() => {
  const CONFIG = {
    TOKEN_KEY: "autoflow_token",
    USER_KEY: "autoflow_user",
    API_BASE: typeof window.API_BASE_URL === "string" ? window.API_BASE_URL : "",
  };

  async function apiFetch(endpoint, options = {}) {
    const url = CONFIG.API_BASE + endpoint;
    const opts = buildOptions(options);

    let res;
    try {
      res = await fetch(url, opts);
    } catch (err) {
      console.error("[apiFetch] Network error:", err);
      throw new Error("Unable to connect to server.");
    }

    let data = null;
    try {
      // Handle 204 No Content or empty responses
      if (res.status !== 204) {
        data = await res.json();
      }
    } catch (_) {
      data = null;
    }

    // Handle Auth Errors
    if (res.status === 401) {
      if (!endpoint.includes("/auth/login")) {
        handleUnauthorized();
      }
      const msg = data && data.message ? data.message : "Unauthorized";
      const err = new Error(msg);
      err.status = 401;
      throw err;
    }

    // Handle General Errors
    if (!res.ok) {
      const msg = data && data.message ? data.message : `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    return data;
  }

  async function callApi(endpoint, options = {}) {
    try {
      return await apiFetch(endpoint, options);
    } catch (err) {
      console.warn("[callApi] Error:", err.message);
      return null;
    }
  }

  function buildOptions(options = {}) {
    const opts = { ...options };
    opts.headers = { ...options.headers };

    const token = getToken();
    if (token) {
      opts.headers["Authorization"] = `Bearer ${token}`;
    }

    // Handle JSON payloads vs FormData
    if (opts.body && !(opts.body instanceof FormData)) {
      // Default to JSON if no Content-Type provided
      if (!hasContentType(opts.headers)) {
        opts.headers["Content-Type"] = "application/json";
      }

      // Auto-stringify object bodies if sending JSON
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

  function handleUnauthorized() {
    try {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      localStorage.removeItem(CONFIG.USER_KEY);
      sessionStorage.removeItem(CONFIG.TOKEN_KEY);
      sessionStorage.removeItem(CONFIG.USER_KEY);
    } catch (_) {}

    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "login.html";
    }
  }

  window.apiFetch = apiFetch;
  window.callApi = callApi;
})();
