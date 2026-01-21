// server.js
/**
 * AutoFlow Backend Entry Point
 * ============================
 * - Loads environment variables
 * - Connects to MongoDB
 * - Starts Express server only after DB is ready
 */

require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to database first
    await connectDB();
    console.log("Database connected");

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
