/**
 * Database connection config — creates a PostgreSQL connection pool.
 * When deployed on Render, DATABASE_URL is set as an environment variable
 * and we connect using that. Locally, we fall back to individual DB_* variables
 * from the .env file (or hardcoded defaults for development convenience).
 */

import { Pool } from "pg";
import dotenv from "dotenv";

// Load environment variables from .env file into process.env
dotenv.config();

// If DATABASE_URL is set (e.g. on Render), use that connection string directly.
// Otherwise build the config from individual host/user/password/etc. variables.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Render's managed Postgres requires SSL but uses a self-signed cert,
      // so we disable certificate verification to avoid connection errors
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER || "postgres",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "lifelong_learner_connect",
      password: process.env.DB_PASSWORD || "lifelong_learner_connect",
      port: parseInt(process.env.DB_PORT || "5432"),
    });

export { pool };
