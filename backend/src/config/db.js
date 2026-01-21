// backend/src/config/db.js
/**
 * Database Configuration — AutoFlow
 * =================================================
 * Responsibilities:
 * - Establish connection to MongoDB (Atlas or Local)
 * - Fail fast if MONGO_URI is missing
 * - Handle runtime connection events (errors, disconnections)
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  // 1. Safety Check: Ensure URI exists
  if (!process.env.MONGO_URI) {
    console.error("❌ FATAL: MONGO_URI is not defined in .env file");
    process.exit(1);
  }

  try {
    // 2. Connect
    // Note: useNewUrlParser/useUnifiedTopology are default in Mongoose 6+
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // 3. Runtime Event Listeners (Handle drops after startup)
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB Runtime Error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB Disconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
