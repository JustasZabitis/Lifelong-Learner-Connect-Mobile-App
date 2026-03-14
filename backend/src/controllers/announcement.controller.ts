import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================
   GET ANNOUNCEMENTS
   - Educators & admins: return ALL announcements (they could be remote),
     optionally filtered by ?student_group=xxx query param
   - Students: return announcements targeted to 'all' or their role
========================= */
export const getAnnouncements = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const role = req.user?.role;
    const isStaff = role === "educator" || role === "admin";
    const groupFilter = req.query.student_group as string | undefined;

    let query: string;
    const params: any[] = [];

    if (isStaff) {
      // Staff see ALL announcements by default (they could be remote)
      // Optionally narrow by student_group filter chip
      if (groupFilter && groupFilter !== "all") {
        query = `
          SELECT a.*,
                 COUNT(ar.id) AS read_count
          FROM announcements a
          LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id
          WHERE a.student_group = $1
          GROUP BY a.id
          ORDER BY a.created_at DESC`;
        params.push(groupFilter);
      } else {
        query = `
          SELECT a.*,
                 COUNT(ar.id) AS read_count
          FROM announcements a
          LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id
          GROUP BY a.id
          ORDER BY a.created_at DESC`;
      }
    } else {
      // Students see announcements for 'all' or their specific role
      query = `
        SELECT a.*,
               COUNT(ar.id) AS read_count
        FROM announcements a
        LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id
        WHERE a.role_target = $1 OR a.role_target = 'all'
        GROUP BY a.id
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

/* =========================
   CREATE ANNOUNCEMENT
   Educators and admins only.
   Now accepts student_group for targeted messaging.
========================= */
export const createAnnouncement = async (
  req: AuthRequest,
  res: Response
) => {
  const { title, content, priority, role_target, student_group } = req.body;

  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO announcements
       (title, content, priority, role_target, student_group, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        title,
        content,
        priority || "medium",
        role_target || "all",
        student_group || null,
        req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create announcement" });
  }
};

/* =========================
   DELETE ANNOUNCEMENT
========================= */
export const deleteAnnouncement = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const announcement = await pool.query(
      "SELECT created_by FROM announcements WHERE id = $1",
      [req.params.id]
    );

    if (announcement.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const creatorId = announcement.rows[0].created_by;
    const isCreator = req.user?.id === creatorId;
    const isEducatorOrAdmin =
      req.user?.role === "educator" || req.user?.role === "admin";

    if (!isCreator && !isEducatorOrAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await pool.query(
      "DELETE FROM announcements WHERE id = $1",
      [req.params.id]
    );

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
};

/* =========================
   UPDATE ANNOUNCEMENT
   Now also updates student_group
========================= */
export const updateAnnouncement = async (
  req: AuthRequest,
  res: Response
) => {
  const { title, content, priority, student_group } = req.body;

  try {
    const announcement = await pool.query(
      "SELECT created_by FROM announcements WHERE id = $1",
      [req.params.id]
    );

    if (announcement.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const creatorId = announcement.rows[0].created_by;
    const isCreator = req.user?.id === creatorId;
    const isEducatorOrAdmin =
      req.user?.role === "educator" || req.user?.role === "admin";

    if (!isCreator && !isEducatorOrAdmin) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const result = await pool.query(
      `UPDATE announcements
       SET title = $1, content = $2, priority = $3, student_group = $4
       WHERE id = $5
       RETURNING *`,
      [title, content, priority, student_group || null, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
};

/* =========================
   MARK AS READ
========================= */
export const markAsRead = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const announcementId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await pool.query(
      `INSERT INTO announcement_reads (announcement_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (announcement_id, user_id) DO NOTHING`,
      [announcementId, userId]
    );

    res.json({ message: "Marked as read" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};