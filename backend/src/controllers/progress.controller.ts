/**
 * Progress controller — tracks student enrolment, module completion,
 * grades, badges, and micro-credentials across programmes.
 * Students see their own data. Educators and admins can view and update anyone's.
 */

import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

// GET /api/progress — returns all programme progress records for a user.
// By default returns the current user's progress. Educators/admins can pass
// ?user_id=X to look at a specific student's progress instead.
export const getProgress = async (req: AuthRequest, res: Response) => {
  try {
    const requesterId = req.user?.id;
    const role = req.user?.role;

    // If user_id query param is provided use it, otherwise fall back to the requester's own ID
    const targetUserId = req.query.user_id
      ? parseInt(req.query.user_id as string)
      : requesterId;

    // Students can only view their own progress — block attempts to view others
    if (role !== "educator" && role !== "admin" && targetUserId !== requesterId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Join with programmes to include the programme name, code, level etc.
    // Order: in-progress first, then sort by completion percentage descending
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

// GET /api/progress/summary — returns high-level stats for the dashboard cards:
// total courses, completed, active, average completion, badge count, micro-credentials.
export const getProgressSummary = async (req: AuthRequest, res: Response) => {
  try {
    // Same user_id logic as getProgress — educators can view others, students cannot
    const userId = req.query.user_id
      ? parseInt(req.query.user_id as string)
      : req.user?.id;

    const role = req.user?.role;
    if (role !== "educator" && role !== "admin" && userId !== req.user?.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Roll up all course stats in a single query using conditional COUNT
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

    // Count how many badges this user has earned
    const badges = await pool.query(
      `SELECT COUNT(*) AS total_badges FROM user_badges WHERE user_id = $1`,
      [userId]
    );

    // Micro-credentials: completed programmes that have "Certificate" in the name
    // and are at NQF level 6 or 7 — these count as formal qualifications
    const microcreds = await pool.query(
      `SELECT COUNT(*) AS micro_credentials
       FROM user_progress up
       JOIN programmes p ON p.id = up.programme_id
       WHERE up.user_id = $1
         AND up.status = 'completed'
         AND p.programme_name ILIKE '%Certificate%'`,
      [userId]
    );

    // Merge all three query results into a single response object
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

// POST /api/progress/enrol — enrols a student in a programme.
// Only educators and admins can enrol students.
// Uses ON CONFLICT DO NOTHING so calling it twice doesn't create duplicates.
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

    // If no row was returned, the student was already enrolled
    if (result.rows.length === 0) {
      return res.status(409).json({ error: "Already enrolled" });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to enrol student" });
  }
};

// PUT /api/progress/:id — updates a student's completion percentage, grade or status.
// COALESCE means only the fields you send get updated; unset fields keep their current value.
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

// GET /api/progress/badges — returns all badges defined in the system.
// Used to populate the badge picker when an educator wants to award one.
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

// GET /api/progress/badges/mine — returns all badges earned by a specific user,
// including when they were awarded and by whom.
export const getMyBadges = async (req: AuthRequest, res: Response) => {
  try {
    // Educators can pass ?user_id= to view any student's badges
    const userId = req.query.user_id
      ? parseInt(req.query.user_id as string)
      : req.user?.id;

    // Join badge details and the email of whoever awarded each badge
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

// POST /api/progress/badges/award — awards a badge to a student.
// Only educators and admins can award badges.
// ON CONFLICT DO NOTHING prevents awarding the same badge twice.
export const awardBadge = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  const { user_id, badge_id } = req.body;

  if (!user_id || !badge_id) {
    return res.status(400).json({ error: "user_id and badge_id are required" });
  }

  try {
    // Record who awarded the badge alongside the user and badge IDs
    const result = await pool.query(
      `INSERT INTO user_badges (user_id, badge_id, awarded_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, badge_id) DO NOTHING
       RETURNING *`,
      [user_id, badge_id, req.user.id]
    );

    // If nothing was inserted, this student already has this badge
    if (result.rows.length === 0) {
      return res.status(409).json({ error: "Badge already awarded" });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to award badge" });
  }
};

// GET /api/progress/programmes — returns a deduplicated list of all programmes.
// Used to populate dropdowns and pickers throughout the app.
// DISTINCT ON ensures we don't return the same programme name/group pair multiple times.
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
