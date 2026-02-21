import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db";

interface RegisterInput {
  email: string;
  password: string;
  role: string;
}

export const registerUser = async ({
  email,
  password,
  role,
}: RegisterInput) => {
  const existing = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `INSERT INTO users (email, password, role)
     VALUES ($1, $2, $3)
     RETURNING id, email, role`,
    [email, hashedPassword, role]
  );

  return result.rows[0];
};

export const loginUser = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid credentials");
  }

  const user = result.rows[0];

  const match = await bcrypt.compare(password, user.password);

  if (!match) {
    throw new Error("Invalid credentials");
  }

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET || "devsecret",
    { expiresIn: "1h" }
  );

  return token;
};