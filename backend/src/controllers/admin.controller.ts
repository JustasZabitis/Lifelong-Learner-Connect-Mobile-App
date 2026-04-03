/**
 * Admin controllers for user management, role changes, suspensions, and audit logging.
 * All functions check admin role and log actions for compliance tracking.
 */

import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";
import bcrypt from "bcrypt";

// Helper function to check if the current user has admin role
const requireAdmin = (req: AuthRequest, res: Response): boolean => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
};

// Helper function to log admin actions to the audit table for compliance tracking
const logAudit = async (
  adminId: number,
  action: string,
  targetUserId: number | null,
  details: string
) => {
  try {
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [adminId, action, targetUserId, details]
    );
  } catch (err) {
    // Audit logging is non-blocking; log errors but don't fail the main request
    console.error("Audit log error:", err);
  }
};

// Initializes the audit log table and adds new columns to users table if they don't exist
export const ensureAuditTable = async () => {
  // Create audit logs table for tracking all admin actions
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL,
      target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      details TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Add new columns to users table for suspension, login tracking, and force-logout support
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS programme TEXT;
  `);

  // Add columns for account lockout after repeated failed login attempts.
  // failed_login_attempts tracks how many wrong passwords in a row.
  // lockout_until is the timestamp until which login is blocked.
  // These are separate from admin-imposed suspension so an admin unsuspend
  // also clears the lockout counters independently.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMPTZ;
  `);
};

// Fetches a list of all users with optional filtering by search, role, or status
export const getUsers = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { search, role, status } = req.query;

    // Build the base query that computes status from suspension, lockout, and login fields.
    // Priority order: suspended > locked > never_logged_in > active
    let query = `
      SELECT
        id, email, role, programme, created_at, last_login, suspended,
        failed_login_attempts, lockout_until,
        CASE WHEN suspended THEN 'suspended'
             WHEN lockout_until IS NOT NULL AND lockout_until > NOW() THEN 'locked'
             WHEN last_login IS NULL THEN 'never_logged_in'
             ELSE 'active'
        END AS status
      FROM users
      WHERE 1=1
    `;
    const params: any[] = [];
    let i = 1;

    // If search term provided, filter by email or programme name (case-insensitive)
    if (search) {
      query += ` AND (email ILIKE $${i} OR programme ILIKE $${i})`;
      params.push(`%${search}%`);
      i++;
    }

    // If role filter provided, only show users with that role (student, educator, admin)
    if (role) {
      query += ` AND role = $${i}`;
      params.push(role);
      i++;
    }

    // Filter by computed status
    if (status === "suspended") {
      query += ` AND suspended = TRUE`;
    } else if (status === "locked") {
      query += ` AND suspended = FALSE AND lockout_until IS NOT NULL AND lockout_until > NOW()`;
    } else if (status === "active") {
      query += ` AND suspended = FALSE AND (lockout_until IS NULL OR lockout_until <= NOW())`;
    }

    // Sort by creation date, newest first
    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error("getUsers error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch users" });
  }
};

// Fetches a single user's profile by ID
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const id = String(req.params.id);
  const result = await pool.query(
    `SELECT id, email, role, programme, created_at, last_login, suspended,
            failed_login_attempts, lockout_until FROM users WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(result.rows[0]);
};

// Creates a new user account with the given email, password, and role
export const createUser = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { email, password, role, programme } = req.body;

    // Validate that required fields are present
    if (!email || !password || !role) {
      return res.status(400).json({ error: "email, password and role are required" });
    }

    // Check if user with this email already exists
    const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
    }

    // Hash the password using bcrypt with salt rounds of 10
    const hashed = await bcrypt.hash(password, 10);

    // Try inserting with programme column; fall back if column doesn't exist yet (backwards compatibility)
    let result;
    try {
      result = await pool.query(
        `INSERT INTO users (email, password, role, programme, created_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING id, email, role, programme, created_at`,
        [email, hashed, role, programme || null]
      );
    } catch (colErr: any) {
      // Error code 42703 means "undefined column" - the programme column doesn't exist yet
      if (colErr.code === "42703") {
        result = await pool.query(
          `INSERT INTO users (email, password, role, created_at)
           VALUES ($1, $2, $3, NOW()) RETURNING id, email, role, created_at`,
          [email, hashed, role]
        );
      } else {
        throw colErr;
      }
    }

    // Log this admin action in the audit trail
    await logAudit(req.user.id, "CREATE_USER", result.rows[0].id, `Created user ${email} with role ${role}`);
    return res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error("createUser error:", err);
    return res.status(500).json({ error: err.message || "Failed to create user" });
  }
};

// Deletes a user account by ID (prevents self-deletion as a safety measure)
export const deleteUser = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const id = String(req.params.id);

  // Prevent accidental self-deletion
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }

  // Check if user exists before deleting
  const user = await pool.query(`SELECT email FROM users WHERE id = $1`, [id]);
  if (user.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  // Delete the user from the database
  await pool.query(`DELETE FROM users WHERE id = $1`, [id]);

  // Log this deletion in the audit trail
  await logAudit(req.user.id, "DELETE_USER", parseInt(id), `Deleted user ${user.rows[0].email}`);
  res.json({ message: "User deleted successfully" });
};

// Toggles suspension status for a user (true = suspended, false = active)
export const toggleSuspend = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const id = String(req.params.id);
  const { suspended } = req.body;

  // Update only the suspended flag — lockout is a completely separate mechanism
  // and is managed by the dedicated unlockUser endpoint below.
  const result = await pool.query(
    `UPDATE users SET suspended = $1 WHERE id = $2 RETURNING id, email, suspended`,
    [suspended, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  // Log the action with different action names for suspension vs unsuspension
  const action = suspended ? "SUSPEND_USER" : "UNSUSPEND_USER";
  await logAudit(req.user.id, action, parseInt(id), `${action} for ${result.rows[0].email}`);
  res.json(result.rows[0]);
};

// Clears the automatic login lockout for a user — completely separate from suspension.
// Resets failed_login_attempts to 0 and clears lockout_until so they can log in again immediately.
export const unlockUser = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const id = String(req.params.id);

  const result = await pool.query(
    `UPDATE users
     SET failed_login_attempts = 0, lockout_until = NULL
     WHERE id = $1
     RETURNING id, email, suspended`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  await logAudit(req.user.id, "UNLOCK_USER", parseInt(id), `Cleared login lockout for ${result.rows[0].email}`);
  res.json(result.rows[0]);
};

// Changes a user's role to one of the valid roles (student, educator, admin)
export const changeRole = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const id = String(req.params.id);
  const { role } = req.body;

  // Validate that the requested role is one of the allowed values
  const validRoles = ["student", "educator", "admin"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  // Update the user's role and return the updated record
  const result = await pool.query(
    `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role`,
    [role, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  // Log this privilege change in the audit trail
  await logAudit(req.user.id, "CHANGE_ROLE", parseInt(id), `Changed role to ${role} for ${result.rows[0].email}`);
  res.json(result.rows[0]);
};

// Allows an admin to reset a user's password to a new value
export const resetPassword = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const id = String(req.params.id);
  const { newPassword } = req.body;

  // Validate the new password meets minimum requirements
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  // Hash the new password with bcrypt before storing
  const hashed = await bcrypt.hash(newPassword, 10);

  // Update the user's password in the database
  const result = await pool.query(
    `UPDATE users SET password = $1 WHERE id = $2 RETURNING id, email`,
    [hashed, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  // Log this security action in the audit trail
  await logAudit(req.user.id, "RESET_PASSWORD", parseInt(id), `Password reset for ${result.rows[0].email}`);
  res.json({ message: "Password reset successfully" });
};

// Forces a user's session to be invalidated immediately by setting force_logout_at timestamp
export const forceLogout = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const id = String(req.params.id);

  // Set force_logout_at to the current timestamp; the auth middleware will reject any
  // tokens issued before this time, effectively logging out the user everywhere
  const result = await pool.query(
    `UPDATE users SET force_logout_at = NOW() WHERE id = $1 RETURNING id, email`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  // Log this forceful logout action
  await logAudit(req.user.id, "FORCE_LOGOUT", parseInt(id), `Forced logout for ${result.rows[0].email}`);
  res.json({ message: "User session invalidated" });
};

// Deletes multiple users at once, useful for cleanup or data management
export const bulkDeleteUsers = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { userIds } = req.body;

  // Validate that userIds is a non-empty array
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "userIds array required" });
  }

  // Filter out the current admin to prevent accidental self-deletion
  const filteredIds = userIds.filter((id: number) => id !== req.user.id);

  // Delete all specified users using SQL's ANY operator for efficient bulk deletion
  await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [filteredIds]);

  // Log this bulk operation in the audit trail
  await logAudit(req.user.id, "BULK_DELETE", null, `Bulk deleted ${filteredIds.length} users`);
  res.json({ message: `${filteredIds.length} users deleted` });
};

// Fetches audit logs showing all admin actions with pagination support
export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { limit = 100, offset = 0 } = req.query;

  // Query audit logs with admin and target user information joined from users table
  const result = await pool.query(
    `SELECT
       l.id, l.action, l.details, l.created_at,
       a.email AS admin_email,
       t.email AS target_email
     FROM admin_audit_logs l
     LEFT JOIN users a ON a.id = l.admin_id
     LEFT JOIN users t ON t.id = l.target_user_id
     ORDER BY l.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  res.json(result.rows);
};

// Fetches comprehensive statistics about users for the admin dashboard
export const getStats = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  // Run all stats queries in parallel for better performance
  const [totalResult, roleResult, dailyResult, programmeResult, inactiveResult] =
    await Promise.all([
      // Count total number of users in the system
      pool.query(`SELECT COUNT(*) AS total FROM users`),

      // Count users by role (student, educator, admin)
      pool.query(`SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY count DESC`),

      // Count new user registrations per day for the last 30 days
      pool.query(`
        SELECT DATE(created_at) AS date, COUNT(*) AS count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `),

      // Count users by programme, showing top 10 programmes
      pool.query(`
        SELECT COALESCE(programme, 'Not Set') AS programme, COUNT(*) AS count
        FROM users
        GROUP BY programme
        ORDER BY count DESC
        LIMIT 10
      `),

      // Count inactive users (never logged in for 30+ days, or never logged in at all)
      pool.query(`
        SELECT COUNT(*) AS count FROM users
        WHERE (last_login IS NULL AND created_at < NOW() - INTERVAL '30 days')
           OR (last_login < NOW() - INTERVAL '30 days')
      `),
    ]);

  // Return all stats combined as a single response
  res.json({
    total: parseInt(totalResult.rows[0].total),
    byRole: roleResult.rows,
    dailyRegistrations: dailyResult.rows,
    byProgramme: programmeResult.rows,
    inactiveCount: parseInt(inactiveResult.rows[0].count),
  });
};

// Fetches list of inactive users (haven't logged in for N days or never logged in)
export const getInactiveUsers = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  const { days = 30 } = req.query;

  // Query users who are either:
  // 1) Never logged in but account created more than N days ago, OR
  // 2) Last login was more than N days ago
  const result = await pool.query(
    `SELECT id, email, role, programme, created_at, last_login
     FROM users
     WHERE (last_login IS NULL AND created_at < NOW() - INTERVAL '1 day' * $1)
        OR (last_login < NOW() - INTERVAL '1 day' * $1)
     ORDER BY COALESCE(last_login, created_at) ASC`,
    [days]
  );

  res.json(result.rows);
};
