// backend/src/routes/authRoutes.js
const express = require("express");
const router = express.Router();

const {
  register,
  login,
  getMe,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);

// Method Not Allowed handlers
router.all("/login", (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      message: "Method Not Allowed. Use POST /api/auth/login",
    });
  }
});

router.all("/register", (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      message: "Method Not Allowed. Use POST /api/auth/register",
    });
  }
});

module.exports = router;
