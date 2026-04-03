/**
 * Authentication service for user registration and login.
 * Handles password hashing, JWT token generation, and user validation.
 * Also enforces escalating account lockout after repeated failed login attempts.
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db";
import validator from "validator";

interface RegisterInput {
  email: string;
  password: string;
  role: string;
}

// How many failed attempts trigger a lockout
const LOCKOUT_THRESHOLD = 10;

// Escalating lockout durations in minutes based on how many lockouts have occurred.
// The index maps to: 1st lockout = 5m, 2nd = 10m, 3rd = 15m, 4th = 30m, 5th+ = 60m.
// We derive which tier to use from Math.floor(attempts / LOCKOUT_THRESHOLD) - 1
const LOCKOUT_DURATIONS_MINUTES = [5, 10, 15, 30, 60];

// Works out the lockout duration in minutes for the current failure count.
// Each additional 10 failures moves to the next tier, capping at 60 minutes.
const getLockoutMinutes = (totalAttempts: number): number => {
  const tier = Math.floor(totalAttempts / LOCKOUT_THRESHOLD) - 1;
  const clampedTier = Math.min(tier, LOCKOUT_DURATIONS_MINUTES.length - 1);
  return LOCKOUT_DURATIONS_MINUTES[clampedTier];
};

// Creates a new user account with server-side validation
export const registerUser = async ({
  email,
  password,
  role,
}: RegisterInput) => {
  // Validate email format using validator library
  if (!email || !validator.isEmail(email)) {
    throw new Error("Invalid email address.");
  }

  // Validate password meets minimum length requirement
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  // Normalize email (lowercase, trim whitespace) to prevent duplicate accounts
  const cleanEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();

  // Check if a user with this email already exists
  const existing = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [cleanEmail]
  );

  if (existing.rows.length > 0) {
    throw new Error("User already exists");
  }

  // Hash password with bcrypt salt rounds of 10 before storing
  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert new user into database and return their ID and email
  const result = await pool.query(
    `INSERT INTO users (email, password, role)
     VALUES ($1, $2, $3)
     RETURNING id, email, role`,
    [cleanEmail, hashedPassword, role]
  );

  return result.rows[0];
};

// Authenticates user credentials and returns a JWT token if valid.
// Tracks failed attempts and locks the account with escalating durations
// after every 10 consecutive failures.
export const loginUser = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  // Validate email format
  if (!email || !validator.isEmail(email)) {
    throw new Error("Invalid credentials");
  }

  if (!password) {
    throw new Error("Invalid credentials");
  }

  // Normalize email for consistent lookup
  const cleanEmail = validator.normalizeEmail(email) || email.toLowerCase().trim();

  // Look up user in database — include the lockout fields
  const result = await pool.query(
    `SELECT id, email, password, role, suspended, failed_login_attempts, lockout_until
     FROM users WHERE email = $1`,
    [cleanEmail]
  );

  // Use a generic message so attackers can't enumerate valid email addresses
  if (result.rows.length === 0) {
    throw new Error("Invalid credentials");
  }

  const user = result.rows[0];

  // ── Lockout check ────────────────────────────────────────────────────────
  // If lockout_until is set and hasn't expired yet, block the login attempt.
  // We do this before checking the password so a locked account can't be
  // brute-forced even if the attacker already has the right password.
  if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
    const remaining = Math.ceil(
      (new Date(user.lockout_until).getTime() - Date.now()) / 60000
    );
    throw new Error(
      `Account temporarily locked due to too many failed login attempts. ` +
      `Please try again in ${remaining} minute${remaining === 1 ? "" : "s"}, ` +
      `or contact an administrator.`
    );
  }

  // ── Suspended check ───────────────────────────────────────────────────────
  // Admin-imposed suspension — separate from the automatic lockout above.
  if (user.suspended) {
    throw new Error("Your account has been suspended. Please contact an administrator.");
  }

  // ── Password check ────────────────────────────────────────────────────────
  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    // Increment the failed attempt counter
    const newAttempts = (user.failed_login_attempts || 0) + 1;

    if (newAttempts >= LOCKOUT_THRESHOLD && newAttempts % LOCKOUT_THRESHOLD === 0) {
      // Hit a lockout threshold — calculate how long to lock the account
      const minutes = getLockoutMinutes(newAttempts);
      const lockoutUntil = new Date(Date.now() + minutes * 60 * 1000);

      await pool.query(
        `UPDATE users SET failed_login_attempts = $1, lockout_until = $2 WHERE id = $3`,
        [newAttempts, lockoutUntil, user.id]
      );

      throw new Error(
        `Too many failed login attempts. Your account has been locked for ${minutes} minute${minutes === 1 ? "" : "s"}.`
      );
    } else {
      // Below threshold — just increment the counter, no lockout yet
      const attemptsLeft = LOCKOUT_THRESHOLD - (newAttempts % LOCKOUT_THRESHOLD);
      await pool.query(
        `UPDATE users SET failed_login_attempts = $1 WHERE id = $2`,
        [newAttempts, user.id]
      );

      throw new Error(
        `Invalid credentials. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining before account lockout.`
      );
    }
  }

  // ── Successful login ──────────────────────────────────────────────────────
  // Reset failed attempt counter and clear any expired lockout on successful login
  await pool.query(
    `UPDATE users
     SET failed_login_attempts = 0, lockout_until = NULL, last_login = NOW()
     WHERE id = $1`,
    [user.id]
  );

  // Generate JWT token valid for 1 hour
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET || "secret_key_ABCD_8673217853219853965321",
    { expiresIn: "1h" }
  );

  return token;
};
