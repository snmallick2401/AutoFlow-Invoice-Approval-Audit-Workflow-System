<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AutoFlow — Submit Invoice</title>

  <link rel="stylesheet" href="../css/base.css" />
  <link rel="stylesheet" href="../css/layout.css" />
  <link rel="stylesheet" href="../css/components.css" />
  <link rel="stylesheet" href="../css/theme.css" />

  <script>
    (function () {
      try {
        const localTheme = localStorage.getItem("theme");
        const sysTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (localTheme === "dark" || (!localTheme && sysTheme)) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      } catch (e) {}
    })();
  </script>
</head>

<body class="app">

  <header class="navbar" role="banner">
    <div class="nav-left">
      <button id="sidebarToggle" class="icon-btn" aria-label="Toggle Navigation">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>

      <a href="dashboard.html" class="brand">
        <span class="brand-logo">🔁</span>
        <span class="brand-name">AutoFlow</span>
      </a>
    </div>

    <div class="nav-right">
      <div class="user-info">
        <span id="userName" class="user-name">Loading...</span>
        <span id="userRole" class="role-badge">...</span>
      </div>

      <button id="themeToggle" class="icon-btn" aria-label="Toggle Dark Mode" title="Switch Theme">
        🌙
      </button>

      <button id="logoutBtn" class="btn neutral small" title="Sign Out">
        Sign Out
      </button>
    </div>
  </header>

  <div class="layout">
    
    <aside class="sidebar" id="sidebar">
      <nav class="sidebar-nav">
        <ul class="nav-list">
          <li>
            <a href="dashboard.html" class="nav-link">
              <span>📊</span>
              <span>Dashboard</span>
            </a>
          </li>
          <li class="role-restricted" data-role="employee,admin">
            <a href="submit-invoice.html" class="nav-link active">
              <span>📝</span>
              <span>Submit Invoice</span>
            </a>
          </li>
          <li class="role-restricted" data-role="manager,finance,admin">
            <a href="approvals.html" class="nav-link">
              <span>✅</span>
              <span>Approvals</span>
            </a>
          </li>
          <li class="role-restricted" data-role="admin,finance">
            <a href="reports.html" class="nav-link">
              <span>📈</span>
              <span>Reports</span>
            </a>
          </li>
          <li class="role-restricted" data-role="admin">
            <a href="audit-logs.html" class="nav-link">
              <span>🛡️</span>
              <span>Audit Logs</span>
            </a>
          </li>
        </ul>
      </nav>
      <div class="sidebar-footer">
        <p style="font-size: 0.7rem; color: var(--muted); margin: 0;">v1.0.0 • Made with ❤️ by SN</p>
      </div>
    </aside>

    <div class="sidebar-overlay" id="sidebarOverlay"></div>

    <main class="content" id="mainContent">
      <div class="content-width">
        
        <header class="page-header">
          <div>
            <h1 class="page-title">New Invoice</h1>
            <p class="page-breadcrumbs">Submit a request for approval</p>
          </div>
        </header>

        <div style="max-width: 600px; margin: 0 auto;">
          <section class="panel">
            <div class="panel-header">
              <h2 class="panel-title">Invoice Details</h2>
            </div>

            <form id="invoiceForm" novalidate>
              
              <div class="form-group">
                <label for="vendor" style="font-size: 0.9rem; font-weight: 500;">Vendor Name</label>
                <input type="text" id="vendor" name="vendor" placeholder="e.g. Acme Corp" required />
              </div>

              <div class="form-row" style="gap: 1rem;">
                <div style="flex: 1;">
                  <label for="amount" style="font-size: 0.9rem; font-weight: 500;">Amount (INR)</label>
                  <input type="number" id="amount" name="amount" placeholder="0.00" min="1" step="0.01" required />
                </div>
                <div style="flex: 1;">
                  <label for="date" style="font-size: 0.9rem; font-weight: 500;">Invoice Date</label>
                  <input type="date" id="date" name="date" required />
                </div>
              </div>

              <div class="form-group">
                <label for="description" style="font-size: 0.9rem; font-weight: 500;">Description</label>
                <textarea id="description" name="description" rows="3" placeholder="Brief details about services or goods..."></textarea>
              </div>

              <div class="form-group">
                <label for="file" style="font-size: 0.9rem; font-weight: 500;">Attachment (PDF/Image)</label>
                <input type="file" id="file" name="file" accept=".pdf,.png,.jpg,.jpeg" />
                <small class="muted">Max size 5MB.</small>
              </div>

              <div style="margin-top: 2rem; text-align: right;">
                <button type="button" class="btn neutral" onclick="window.location.href='dashboard.html'">Cancel</button>
                <button type="submit" id="submitBtn" class="btn primary">Submit Invoice</button>
              </div>

            </form>
          </section>
        </div>

      </div>
    </main>
  </div>

  <script>window.API_BASE_URL = "http://localhost:5000";</script>
  <script src="../js/theme.js"></script>
  <script src="../js/api.js"></script>
  <script src="../js/submit-invoice.js"></script>

</body>
</html>
