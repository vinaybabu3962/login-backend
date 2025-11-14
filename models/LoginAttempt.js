const mongoose = require("mongoose");

const loginAttemptSchema = new mongoose.Schema({
  email: { type: String, default: "" },  
  ip: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("LoginAttempt", loginAttemptSchema);
