// backend/src/routes/authRoutes.js

const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getMe,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

/* =================================================
   PUBLIC ROUTES
   The frontend (api.js) sends POST requests to these.
================================================= */

// POST /api/auth/register
router.post("/register", register);

// POST /api/auth/login
router.post("/login", login);

/* =================================================
   PROTECTED ROUTES
================================================= */

// GET /api/auth/me
router.get("/me", protect, getMe);

module.exports = router;
