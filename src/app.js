// backend/src/app.js

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");
const auditRoutes = require("./routes/auditRoutes");

const app = express();

/* ===============================
   GLOBAL MIDDLEWARE
================================ */

// 1. Security Headers
// We disable 'contentSecurityPolicy' because your HTML files use inline scripts
// (e.g., the theme toggler in <head>). In a stricter setup, you would use a Nonce.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Logging (Dev mode)
app.use(morgan("dev"));

// 3. CORS & Body Parsing
app.use(cors());
app.use(express.json({ limit: "5mb" })); // Increased limit for PDF uploads
app.use(express.urlencoded({ extended: true }));

/* ===============================
   STATIC FILES (DEPLOYMENT)
================================ */

// 1. Serve Uploaded Files (Invoices)
// Access via: http://your-domain.com/uploads/INV-2023-001.pdf
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 2. Serve Frontend (HTML/CSS/JS)
// This serves index.html, dashboard.html, etc. from 'backend/public'
app.use(express.static(path.join(__dirname, '../public')));

/* ===============================
   HEALTH CHECK
================================ */
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

/* ===============================
   API ROUTES
================================ */
app.use("/api/auth", authRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/audit", auditRoutes);

/* ===============================
   404 HANDLER (API & FILES)
================================ */
app.use((req, res) => {
  // If the request accepts HTML (browser navigation) and wasn't found above,
  // it means the user typed a wrong URL. We can redirect to index or 404.
  if (req.accepts('html')) {
    // Optional: Send a custom 404.html if you have one, or just redirect
    // res.sendFile(path.join(__dirname, '../public/404.html'));
    return res.status(404).send('Page not found');
  }

  // JSON 404 for API calls
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

/* ===============================
   GLOBAL ERROR HANDLER
================================ */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error("❌ Application Error:", err.stack || err);

  const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;

  res.status(status).json({
    message: status === 500 ? "Internal Server Error" : err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
  });
});

module.exports = app;
