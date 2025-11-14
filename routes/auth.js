const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/Users");
const LoginAttempt = require("../models/LoginAttempt");

const router = express.Router();

const USER_THRESHOLD = parseInt(process.env.USER_THRESHOLD || "5");       // failed attempts before suspension
const IP_THRESHOLD = parseInt(process.env.IP_THRESHOLD || "100");         // failed attempts from IP
const WINDOW_MINUTES = parseInt(process.env.WINDOW_MINUTES || "5");       // look back window
const SUSPEND_MINUTES = parseInt(process.env.SUSPEND_MINUTES || "15");    // suspension time


function getClientIp(req) {
  let ip = req.headers["x-forwarded-for"];

  if (ip) {
    ip = ip.split(",")[0].trim();  
  } else {
    ip = req.socket.remoteAddress || "unknown";
  }


  if (ip === "::1") ip = "127.0.0.1";
  if (ip.startsWith("::ffff:")) ip = ip.replace("::ffff:", "");

  return ip;
}



router.post("/register", async (req, res) => {
  try {
    const { name = "", email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and Password are required" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(409).json({ error: "Email already exists" });

    const hash = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      passwordHash: hash
    });

    return res.json({ message: "User registered successfully" });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = getClientIp(req);
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60000);


    const ipFails = await LoginAttempt.countDocuments({
      ip,
      timestamp: { $gte: windowStart }
    });

    if (ipFails >= IP_THRESHOLD) {
      return res.status(429).json({
        error: "IP temporarily blocked due to excessive failed login attempts."
      });
    }

    const user = await User.findOne({ email });


    if (user && user.suspendUntil && user.suspendUntil > new Date()) {
      return res.status(403).json({
        error: "Account suspended. Try again later."
      });
    }


    if (!user) {
      await LoginAttempt.create({ email, ip, timestamp: new Date() });
      return res.status(401).json({ error: "Invalid email or password" });
    }


    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      await LoginAttempt.create({ email, ip, timestamp: new Date() });


      const userFails = await LoginAttempt.countDocuments({
        email,
        timestamp: { $gte: windowStart }
      });

      if (userFails >= USER_THRESHOLD) {
        user.suspendUntil = new Date(
          Date.now() + SUSPEND_MINUTES * 60000
        );
        await user.save();

        return res.status(403).json({
          error: "Account suspended due to multiple failed attempts."
        });
      }

      return res.status(401).json({ error: "Invalid email or password" });
    }

    await LoginAttempt.deleteMany({ email });

    return res.json({ message: "Login successful" });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
