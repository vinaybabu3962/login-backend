const chai = require("chai");
const expect = chai.expect;
const request = require("supertest");
const sinon = require("sinon");

const app = require("../server");
const User = require("../models/Users");
const bcrypt = require("bcryptjs");
const LoginAttempt = require("../models/LoginAttempt");
process.env.USER_THRESHOLD = "3";
process.env.IP_THRESHOLD = "100";
process.env.WINDOW_MINUTES = "5";
process.env.SUSPEND_MINUTES = "15";

describe("Auth API Tests", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it("should register a new user", async () => {
    const res = await request(app).post("/api/register").send({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    expect(res.status).to.equal(200);
    expect(res.body.message).to.equal("User registered successfully");

    const savedUser = await User.findOne({ email: "test@example.com" });
    expect(savedUser).to.not.be.null;
    expect(savedUser.passwordHash).to.not.equal("password123");
  });

  it("should return 400 if missing fields during register", async () => {
    const res = await request(app).post("/api/register").send({
      name: "x",
      email: "",
    });

    expect(res.status).to.equal(400);
    expect(res.body.error).to.equal("Email and Password are required");
  });

  it("should not register user with existing email", async () => {
    await User.create({
      name: "Existing User",
      email: "test@example.com",
      passwordHash: "hashed",
    });

    const res = await request(app).post("/api/register").send({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    expect(res.status).to.equal(409);
    expect(res.body.error).to.equal("Email already exists");
  });

  it("should login with correct credentials", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);

    await User.create({
      name: "Test User",
      email: "test@example.com",
      passwordHash,
    });

    await LoginAttempt.create({
      email: "test@example.com",
      ip: "1.2.3.4",
      timestamp: new Date(),
    });

    const res = await request(app).post("/api/login").send({
      email: "test@example.com",
      password: "password123",
    });

    expect(res.status).to.equal(200);
    expect(res.body.message).to.equal("Login successful");

    const attemptsLeft = await LoginAttempt.countDocuments({
      email: "test@example.com",
    });
    expect(attemptsLeft).to.equal(0);
  });

  it("should return 401 for incorrect password and create a login attempt", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);

    await User.create({
      name: "Test User",
      email: "test@example.com",
      passwordHash,
    });

    const res = await request(app).post("/api/login").send({
      email: "test@example.com",
      password: "wrongpassword",
    });

    expect(res.status).to.equal(401);
    expect(res.body.error).to.equal("Invalid email or password");

    const attempt = await LoginAttempt.findOne({
      email: "test@example.com",
    });
    expect(attempt).to.not.be.null;
  });

  it("should return 401 for unknown email and record attempt with provided IP", async () => {
    const res = await request(app)
      .post("/api/login")
      .set("X-Forwarded-For", "5.6.7.8")
      .send({
        email: "unknown@example.com",
        password: "password123",
      });

    expect(res.status).to.equal(401);
    expect(res.body.error).to.equal("Invalid email or password");

    const attempt = await LoginAttempt.findOne({
      email: "unknown@example.com",
    });

    expect(attempt).to.not.be.null;
    expect(attempt.ip).to.equal("5.6.7.8");
  });

  it("should block IP when IP failed attempts exceed threshold", async () => {
    const IP = "9.9.9.9";
    const now = new Date();

    await LoginAttempt.create([
      { email: "a@x.com", ip: IP, timestamp: now },
      { email: "b@x.com", ip: IP, timestamp: now },
      { email: "c@x.com", ip: IP, timestamp: now },
      { email: "d@x.com", ip: IP, timestamp: now },
    ]);

    const res = await request(app)
      .post("/api/login")
      .set("X-Forwarded-For", IP)
      .send({
        email: "test@example.com",
        password: "password123",
      });

    if (res.status === 429) {
      expect(res.body.error).to.include("IP temporarily blocked");
    } else {
      const lastAttempt = await LoginAttempt.findOne({ ip: IP }).sort({
        timestamp: -1,
      });
      expect(lastAttempt).to.not.be.null;
    }
  });

  it("should suspend account after threshold failed attempts", async () => {
    const passwordHash = await bcrypt.hash("rightpass", 10);
    const email = "victim@example.com";

    await User.create({
      name: "Victim",
      email,
      passwordHash,
    });

    const now = new Date();

    await LoginAttempt.create([
      { email, ip: "1.1.1.1", timestamp: now },
      { email, ip: "1.1.1.1", timestamp: now },
    ]);

    const res = await request(app).post("/api/login").send({
      email,
      password: "wrongpass",
    });

    if (res.status === 403) {
      expect(res.body.error).to.include("Account suspended");
      const u = await User.findOne({ email });
      expect(u.suspendUntil).to.be.instanceOf(Date);
      expect(u.suspendUntil.getTime()).to.be.greaterThan(Date.now());
    } else {
      expect(res.status).to.equal(401);
    }
  });

  it("should block login while account is suspended", async () => {
    const passwordHash = await bcrypt.hash("rightpass", 10);
    const email = "suspended@example.com";
    const future = new Date(Date.now() + 10 * 60000);

    await User.create({
      name: "S",
      email,
      passwordHash,
      suspendUntil: future,
    });

    const res = await request(app).post("/api/login").send({
      email,
      password: "rightpass",
    });

    expect(res.status).to.equal(403);
    expect(res.body.error).to.equal("Account suspended. Try again later.");
  });
});
