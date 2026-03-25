/**
 * Authentication service for user registration and login.
 * Handles password hashing, JWT token generation, and user validation.
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

// Authenticates user credentials and returns a JWT token if valid
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

  // Look up user in database
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [cleanEmail]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid credentials");
  }

  const user = result.rows[0];

  // Compare submitted password against stored bcrypt hash
  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    throw new Error("Invalid credentials");
  }

  // Prevent login if account has been suspended by an admin
  if (user.suspended) {
    throw new Error("Your account has been suspended. Please contact an administrator.");
  }

  // Update last_login timestamp for admin analytics and inactivity tracking
  await pool.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);

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