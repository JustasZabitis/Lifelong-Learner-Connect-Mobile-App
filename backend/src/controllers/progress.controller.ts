import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================
   GET MY PROGRESS
   Students see their own progress.
   Educators/admins can pass ?user_id= to view a specific student.
========================= */
export const getProgress = async (req: AuthRequest, res: Response) => {
  try {
    const requesterId = req.user?.id;
    const role = req.user?.role;
    const targetUserId = req.query.user_id
      ? parseInt(req.query.user_id as string)
      : requesterId;

    // Students can only view their own
    if (role !== "educator" && role !== "admin" && targetUserId !== requesterId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const result = await pool.query(
      `SELECT
         up.*,
         p.programme_name,
         p.programme_code,
         p.programme_year,
         p.nqai_level,
         p.student_group
       FROM user_progress up
       JOIN programmes p ON p.id = up.programme_id
       WHERE up.user_id = $1
       ORDER BY up.status ASC, up.completion_percent DESC`,
      [targetUserId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
};

/* =========================
   GET PROGRESS SUMMARY
   Returns stats for the dashboard cards
========================= */
export const getProgressSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.query.user_id
      ? parseInt(req.query.user_id as string)
      : req.user?.id;

    const role = req.user?.role;
    if (role !== "educator" && role !== "admin" && userId !== req.user?.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Course stats
    const courses = await pool.query(
      `SELECT
         COUNT(*) AS total_courses,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed_courses,
         COUNT(*) FILTER (WHERE status = 'in_progress') AS active_courses,
         COALESCE(AVG(completion_percent), 0) AS avg_completion
       FROM user_progress
       WHERE user_id = $1`,
      [userId]
    );

    // Badge count
    const badges = await pool.query(
      `SELECT COUNT(*) AS total_badges FROM user_badges WHERE user_id = $1`,
      [userId]
    );

    // Micro-credentials (completed certs at level 6 or 7 with 'Certificate' in name)
    const microcreds = await pool.query(
      `SELECT COUNT(*) AS micro_credentials
       FROM user_progress up
       JOIN programmes p ON p.id = up.programme_id
       WHERE up.user_id = $1
         AND up.status = 'completed'
         AND p.programme_name ILIKE '%Certificate%'`,
      [userId]
    );

    res.json({
      ...courses.rows[0],
      total_badges: parseInt(badges.rows[0].total_badges),
      micro_credentials: parseInt(microcreds.rows[0].micro_credentials),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
};

/* =========================
   ENROL STUDENT IN PROGRAMME
   Educators/admins only
========================= */
export const enrolStudent = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { user_id, programme_id } = req.body;

  if (!user_id || !programme_id) {
    return res.status(400).json({ error: "user_id and programme_id are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO user_progress (user_id, programme_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, programme_id) DO NOTHING
       RETURNING *`,
      [user_id, programme_id]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: "Already enrolled" });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to enrol student" });
  }
};

/* =========================
   UPDATE PROGRESS
   Educators/admins update completion, grade, status
========================= */
export const updateProgress = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { completion_percent, current_grade, status } = req.body;
  const progressId = req.params.id;

  try {
    const result = await pool.query(
      `UPDATE user_progress
       SET completion_percent = COALESCE($1, completion_percent),
           current_grade = COALESCE($2, current_grade),
           status = COALESCE($3, status),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [completion_percent, current_grade, status, progressId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Progress record not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update progress" });
  }
};

/* =========================
   GET ALL BADGES
========================= */
export const getAllBadges = async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM badges ORDER BY id ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch badges" });
  }
};

/* =========================
   GET MY BADGES
========================= */
export const getMyBadges = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.query.user_id
      ? parseInt(req.query.user_id as string)
      : req.user?.id;

    const result = await pool.query(
      `SELECT
         b.*,
         ub.earned_at,
         u.email AS awarded_by_email
       FROM user_badges ub
       JOIN badges b ON b.id = ub.badge_id
       LEFT JOIN users u ON u.id = ub.awarded_by
       WHERE ub.user_id = $1
       ORDER BY ub.earned_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch badges" });
  }
};

/* =========================
   AWARD BADGE
   Educators/admins only
========================= */
export const awardBadge = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { user_id, badge_id } = req.body;

  if (!user_id || !badge_id) {
    return res.status(400).json({ error: "user_id and badge_id are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO user_badges (user_id, badge_id, awarded_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, badge_id) DO NOTHING
       RETURNING *`,
      [user_id, badge_id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: "Badge already awarded" });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to award badge" });
  }
};

/* =========================
   GET ALL PROGRAMMES
   For dropdowns/pickers
========================= */
export const getProgrammes = async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (programme_name, student_group)
         id, programme_code, programme_name, nqai_level, student_group
       FROM programmes
       ORDER BY programme_name, student_group, programme_year ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch programmes" });
  }
};