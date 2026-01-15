// frontend/js/theme.js
"use strict";

(() => {
  const CONFIG = {
    KEY: "theme",
    DARK_CLS: "dark",
    ICON_MOON: "🌙",
    ICON_SUN: "☀️"
  };

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggle");
    const root = document.documentElement;

    if (!btn) return;

    // Sync button state with current theme (set by inline head script)
    const initialDark = root.classList.contains(CONFIG.DARK_CLS);
    updateButton(btn, initialDark);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      
      const isNowDark = root.classList.toggle(CONFIG.DARK_CLS);
      updateButton(btn, isNowDark);
      savePreference(isNowDark);
    });
  });

  function updateButton(btn, isDark) {
    // If Dark, show Sun (to switch to light); if Light, show Moon.
    btn.textContent = isDark ? CONFIG.ICON_SUN : CONFIG.ICON_MOON;
    
    const label = isDark ? "Switch to Light Mode" : "Switch to Dark Mode";
    btn.setAttribute("aria-label", label);
    btn.title = label;
  }

  function savePreference(isDark) {
    try {
      localStorage.setItem(CONFIG.KEY, isDark ? "dark" : "light");
    } catch (e) {
      // Ignore storage errors (e.g. Private Browsing)
    }
  }
})();
