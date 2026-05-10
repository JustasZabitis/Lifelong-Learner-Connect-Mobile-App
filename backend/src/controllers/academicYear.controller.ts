/**
 * Academic Year Management Controller
 *
 * Handles end-of-year and start-of-year lifecycle actions for student accounts:
 *   - Graduate students (mark as alumni / deactivate accounts)
 *   - Progress students to the next year level (Year 1 → 2, etc.)
 *   - Send completion / results notifications
 *   - Send welcome / orientation notifications for new year
 *
 * All actions require admin role and are recorded in the audit log.
 */

import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

// ─── Admin guard ──────────────────────────────────────────────────────────────

const requireAdmin = (req: AuthRequest, res: Response): boolean => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
};

// ─── Audit helper ─────────────────────────────────────────────────────────────

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
    console.error("Audit log error:", err);
  }
};

// ─── Ensure schema ────────────────────────────────────────────────────────────
// Adds year_level and alumni status columns if they don't already exist,
// and creates the in-app notifications table if missing.

export const ensureAcademicSchema = async () => {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS year_level INTEGER DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_alumni BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS graduation_year INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS nqai_level INTEGER DEFAULT 8;

    CREATE TABLE IF NOT EXISTS user_notifications (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title         VARCHAR(200) NOT NULL,
      message       TEXT NOT NULL,
      type          VARCHAR(50) DEFAULT 'info',
      is_read       BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("Academic year schema ensured.");
};

// ─── GET /api/academic/overview ───────────────────────────────────────────────
// Returns a summary: students by year level, alumni count, programme breakdown.

export const getOverview = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [byYear, byNqai, alumni, programmes] = await Promise.all([
      pool.query(`
        SELECT year_level, COUNT(*) as count
        FROM users
        WHERE role = 'student' AND is_alumni = FALSE AND suspended = FALSE
        GROUP BY year_level
        ORDER BY year_level
      `),
      pool.query(`
        SELECT nqai_level, COUNT(*) as count
        FROM users
        WHERE role = 'student' AND is_alumni = FALSE AND suspended = FALSE
        GROUP BY nqai_level
        ORDER BY nqai_level DESC
      `),
      pool.query(`
        SELECT COUNT(*) as count FROM users WHERE is_alumni = TRUE
      `),
      pool.query(`
        SELECT programme, COUNT(*) as count
        FROM users
        WHERE role = 'student' AND is_alumni = FALSE AND programme IS NOT NULL
        GROUP BY programme
        ORDER BY count DESC
      `),
    ]);

    res.json({
      byYear: byYear.rows,
      byNqai: byNqai.rows,
      alumniCount: parseInt(alumni.rows[0].count),
      programmes: programmes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch overview" });
  }
};

// ─── POST /api/academic/graduate ─────────────────────────────────────────────
// Mark a list of students as alumni (sets is_alumni=true, suspends account login).
// Body: { userIds: number[], sendNotification: boolean, message?: string }

export const graduateStudents = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { userIds, sendNotification, message } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "userIds array is required" });
  }

  try {
    // Mark as alumni and set graduation year
    await pool.query(
      `UPDATE users
       SET is_alumni = TRUE,
           graduation_year = EXTRACT(YEAR FROM NOW()),
           suspended = TRUE
       WHERE id = ANY($1::int[]) AND role = 'student'`,
      [userIds]
    );

    // Optionally send an in-app notification to each graduate
    if (sendNotification) {
      const notifMessage =
        message ||
        "Congratulations! You have successfully completed your programme. Your account has been archived as alumni status.";

      // Use unnest to insert one row per user_id fully parameterised — no string interpolation into SQL
      await pool.query(
        `INSERT INTO user_notifications (user_id, title, message, type)
         SELECT unnest($1::int[]), $2, $3, $4`,
        [userIds, "Congratulations, Graduate! 🎓", notifMessage, "success"]
      );
    }

    // Audit log each graduation
    for (const id of userIds) {
      await logAudit(req.user.id, "GRADUATE_STUDENT", id, `Marked as alumni. Notification: ${sendNotification}`);
    }

    res.json({ success: true, count: userIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to graduate students" });
  }
};

// ─── POST /api/academic/progress-year ────────────────────────────────────────
// Increment year_level by 1 for a list of students (e.g. Year 1 → Year 2).
// Body: { userIds: number[], sendNotification: boolean, academicYear?: string }

export const progressYear = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { userIds, sendNotification, academicYear } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "userIds array is required" });
  }

  try {
    // Increment year level, capped per NQAI level:
    //   L6 Higher Cert → max 2 years
    //   L7 Ordinary Degree → max 3 years
    //   L8 Honours Degree → max 4 years
    //   L9 Masters/PG → max 2 years
    // Default cap is 4 for unknown/unset levels.
    await pool.query(
      `UPDATE users
       SET year_level = LEAST(
         year_level + 1,
         CASE
           WHEN nqai_level = 6 THEN 2
           WHEN nqai_level = 7 THEN 3
           WHEN nqai_level = 8 THEN 4
           WHEN nqai_level = 9 THEN 2
           ELSE 4
         END
       )
       WHERE id = ANY($1::int[]) AND role = 'student' AND is_alumni = FALSE`,
      [userIds]
    );

    if (sendNotification) {
      // Sanitise academicYear: only allow "YYYY/YYYY" format, fall back to current year if invalid
      const rawYear = typeof academicYear === "string" ? academicYear : "";
      const yearLabel = /^\d{4}\/\d{4}$/.test(rawYear)
        ? rawYear
        : `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;

      // Use unnest to insert one row per user_id fully parameterised — no string interpolation into SQL
      await pool.query(
        `INSERT INTO user_notifications (user_id, title, message, type)
         SELECT unnest($1::int[]), $2, $3, $4`,
        [
          userIds,
          `Welcome to ${yearLabel}! 🎉`,
          "You have been progressed to the next year of your programme. Welcome back — we look forward to another great year with you!",
          "info",
        ]
      );
    }

    for (const id of userIds) {
      await logAudit(req.user.id, "PROGRESS_YEAR", id, `Year level incremented. Notification: ${sendNotification}`);
    }

    res.json({ success: true, count: userIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to progress students" });
  }
};

// ─── POST /api/academic/notify ────────────────────────────────────────────────
// Send a custom in-app notification to a group of students.
// Body: { userIds: number[], title: string, message: string, type: string }

export const sendNotification = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { userIds, title, message, type = "info" } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: "userIds array is required" });
  }
  if (!title || !message) {
    return res.status(400).json({ error: "title and message are required" });
  }

  // Validate type against allowed values only
  const ALLOWED_TYPES = ["info", "success", "warning", "error"];
  const safeType = ALLOWED_TYPES.includes(type) ? type : "info";

  try {
    // Use unnest to insert one row per user_id fully parameterised — no string interpolation into SQL
    await pool.query(
      `INSERT INTO user_notifications (user_id, title, message, type)
       SELECT unnest($1::int[]), $2, $3, $4`,
      [userIds, title, message, safeType]
    );

    await logAudit(
      req.user.id,
      "SEND_NOTIFICATION",
      null,
      `Sent "${title}" to ${userIds.length} student(s). Type: ${type}`
    );

    res.json({ success: true, count: userIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send notifications" });
  }
};

// ─── GET /api/academic/my-notifications ──────────────────────────────────────
// Returns all in-app notifications for the currently logged-in user, newest first.

export const getMyNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const result = await pool.query(
      `SELECT id, title, message, type, is_read, created_at
       FROM user_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
};

// ─── PATCH /api/academic/my-notifications/read-all ───────────────────────────
// Marks all of the current user's notifications as read.

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    await pool.query(
      `UPDATE user_notifications SET is_read = TRUE WHERE user_id = $1`,
      [userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
};

// ─── GET /api/academic/students ───────────────────────────────────────────────
// Returns all active (non-alumni) students with year_level, programme, etc.
// Supports ?yearLevel=1&programme=computing filters.

export const getStudents = async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { yearLevel, programme, search, nqaiLevel } = req.query;

  try {
    let query = `
      SELECT id, email, programme, year_level, nqai_level, created_at, last_login, is_alumni, graduation_year, suspended
      FROM users
      WHERE role = 'student'
    `;
    const params: any[] = [];

    if (yearLevel) {
      params.push(yearLevel);
      query += ` AND year_level = $${params.length}`;
    }
    if (nqaiLevel) {
      params.push(nqaiLevel);
      query += ` AND nqai_level = $${params.length}`;
    }
    if (programme) {
      params.push(programme);
      query += ` AND programme = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND email ILIKE $${params.length}`;
    }

    query += ` ORDER BY nqai_level DESC, year_level ASC, email ASC`;

    const result = await pool.query(query, params);
    res.json({ students: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
};
