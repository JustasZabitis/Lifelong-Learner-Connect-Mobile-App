import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// ─── Database connection ──────────────────────────────────────────────
// On Render, we get a single DATABASE_URL connection string.
// Locally, we use the individual DB_HOST / DB_NAME / etc from .env.
// This checks for DATABASE_URL first and falls back to local config.

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // required for Render's managed Postgres
    })
  : new Pool({
      user: process.env.DB_USER || "postgres",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "lifelong_learner_connect",
      password: process.env.DB_PASSWORD || "lifelong_learner_connect",
      port: parseInt(process.env.DB_PORT || "5432"),
    });

export { pool };