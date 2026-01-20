// backend/public/js/theme.js
"use strict";

(() => {
  // Configuration Constants
  const CONFIG = {
    STORAGE_KEY: "theme",
    DARK_CLASS: "dark",
    ICON_MOON: "🌙",
    ICON_SUN: "☀️"
  };

  /**
   * Initialize the Theme Toggle Button
   */
  function initTheme() {
    const btn = document.getElementById("themeToggle");
    const root = document.documentElement; // <html> tag

    // If the button doesn't exist on this page (e.g., login page), exit safely
    if (!btn) return;

    // 1. Sync Initial Button State
    // The inline script in HTML <head> has already applied the 'dark' class if needed.
    // We just need to make sure the button icon matches that state.
    const isInitiallyDark = root.classList.contains(CONFIG.DARK_CLASS);
    updateButtonUI(btn, isInitiallyDark);

    // 2. Attach Click Event Listener
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      
      // Toggle the class on <html>
      const isNowDark = root.classList.toggle(CONFIG.DARK_CLASS);
      
      // Update the button icon and tooltip
      updateButtonUI(btn, isNowDark);
      
      // Save preference to LocalStorage
      savePreference(isNowDark);
    });
  }

  /**
   * Updates the button icon and accessibility labels
   * @param {HTMLElement} btn 
   * @param {boolean} isDark 
   */
  function updateButtonUI(btn, isDark) {
    // If Dark -> Show Sun (to switch to light)
    // If Light -> Show Moon (to switch to dark)
    btn.textContent = isDark ? CONFIG.ICON_SUN : CONFIG.ICON_MOON;
    
    const label = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
    btn.setAttribute("aria-label", label);
    btn.title = label; // Tooltip on hover
  }

  /**
   * Persist user choice
   * @param {boolean} isDark 
   */
  function savePreference(isDark) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, isDark ? "dark" : "light");
    } catch (e) {
      console.warn("LocalStorage access denied/full:", e);
    }
  }

  // --- Execution Flow ---
  // Wait for the DOM to be fully loaded before looking for the button
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
  } else {
    initTheme();
  }

})();
