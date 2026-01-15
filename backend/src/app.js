// backend/src/app.js
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK" });
});

app.use("/api/auth", authRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  console.error("Unhandled error:", err?.stack || err);

  const status =
    Number.isInteger(err?.statusCode) ? err.statusCode : 500;

  res.status(status).json({
    message: status === 500 ? "Server error" : err.message,
  });
});

module.exports = app;
