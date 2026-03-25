/**
 * Announcement controller — handles creating, reading, updating,
 * deleting and marking announcements as read. Educators and admins
 * can see everything; students only see announcements targeted at them.
 */

import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

// GET /api/announcements — returns all announcements the current user is allowed to see.
// Staff (educator/admin) see everything. Students only see announcements for their role
// or marked for "all", plus any programme-targeted ones.
export const getAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    // Staff get the full picture; students get a filtered view
    const isStaff = role === "educator" || role === "admin";
    const groupFilter = req.query.student_group as string | undefined;

    let query: string;
    const params: any[] = [];

    if (isStaff) {
      if (groupFilter && groupFilter !== "all") {
        // Staff filtering by a specific student group.
        // read_count is computed in a correlated subquery to avoid GROUP BY a.* issues
        // on strict Postgres versions (e.g. Render's managed database).
        query = `
          SELECT a.*,
            (SELECT COUNT(*) FROM announcement_reads ar WHERE ar.announcement_id = a.id) AS read_count
          FROM announcements a
          WHERE a.student_group = $1
          ORDER BY a.created_at DESC`;
        params.push(groupFilter);
      } else {
        // Staff with no filter — return all announcements with read counts
        query = `
          SELECT a.*,
            (SELECT COUNT(*) FROM announcement_reads ar WHERE ar.announcement_id = a.id) AS read_count
          FROM announcements a
          ORDER BY a.created_at DESC`;
      }
    } else {
      // Students see: announcements for their role, announcements for "all",
      // and any programme-targeted announcements
      query = `
        SELECT a.*,
          (SELECT COUNT(*) FROM announcement_reads ar WHERE ar.announcement_id = a.id) AS read_count
        FROM announcements a
        WHERE a.role_target = $1 OR a.role_target = 'all' OR a.programme_name IS NOT NULL
        ORDER BY a.created_at DESC`;
      params.push(role);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
};

// POST /api/announcements — creates a new announcement.
// Only educators and admins can post. Accepts an optional student_group
// OR programme_name to target specific audiences — they're mutually exclusive.
export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  const { title, content, priority, role_target, student_group, programme_name } = req.body;

  // Students can't create announcements
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    // Insert announcement with sensible defaults — priority defaults to "medium",
    // role_target defaults to "all" if not specified
    const result = await pool.query(
      `INSERT INTO announcements (title, content, priority, role_target, student_group, programme_name, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, content, priority || "medium", role_target || "all", student_group || null, programme_name || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create announcement" });
  }
};

// DELETE /api/announcements/:id — removes an announcement.
// Only the creator or staff can delete it.
export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    // Look up the announcement to check who owns it
    const a = await pool.query("SELECT created_by FROM announcements WHERE id = $1", [req.params.id]);
    if (a.rows.length === 0) return res.status(404).json({ error: "Not found" });

    // Allow if they created it OR they're staff
    const isCreator = req.user?.id === a.rows[0].created_by;
    const isStaff = req.user?.role === "educator" || req.user?.role === "admin";
    if (!isCreator && !isStaff) return res.status(403).json({ error: "Not authorized" });

    await pool.query("DELETE FROM announcements WHERE id = $1", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
};

// PUT /api/announcements/:id — updates an existing announcement's content.
// Same permission rules as delete — creator or staff only.
export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
  const { title, content, priority, student_group, programme_name } = req.body;

  try {
    // Fetch the announcement to verify ownership before editing
    const a = await pool.query("SELECT created_by FROM announcements WHERE id = $1", [req.params.id]);
    if (a.rows.length === 0) return res.status(404).json({ error: "Not found" });

    const isCreator = req.user?.id === a.rows[0].created_by;
    const isStaff = req.user?.role === "educator" || req.user?.role === "admin";
    if (!isCreator && !isStaff) return res.status(403).json({ error: "Not authorized" });

    // Update the fields and return the updated row
    const result = await pool.query(
      `UPDATE announcements SET title=$1, content=$2, priority=$3, student_group=$4, programme_name=$5 WHERE id=$6 RETURNING *`,
      [title, content, priority, student_group || null, programme_name || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
};

// POST /api/announcements/:id/read — marks an announcement as read for the current user.
// Uses ON CONFLICT DO NOTHING so calling it twice doesn't cause an error.
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      `INSERT INTO announcement_reads (announcement_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user?.id]
    );
    res.json({ message: "Marked as read" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};
