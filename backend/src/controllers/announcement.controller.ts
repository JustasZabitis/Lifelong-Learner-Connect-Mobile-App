import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================
   GET ANNOUNCEMENTS
   Includes read_count
========================= */
export const getAnnouncements = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const role = req.user?.role;

    const result = await pool.query(
      `SELECT a.*,
              COUNT(ar.id) AS read_count
       FROM announcements a
       LEFT JOIN announcement_reads ar
         ON a.id = ar.announcement_id
       WHERE a.role_target = $1 OR a.role_target = 'all'
       GROUP BY a.id
       ORDER BY a.created_at DESC`,
      [role]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
};

/* =========================
   CREATE ANNOUNCEMENT
========================= */
export const createAnnouncement = async (
  req: AuthRequest,
  res: Response
) => {
  const { title, content, priority, role_target } = req.body;

  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO announcements
       (title, content, priority, role_target, created_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        title,
        content,
        priority || "medium",
        role_target || "all",
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

    if (
      req.user?.id !== creatorId &&
      req.user?.role !== "admin"
    ) {
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

// UPDATE announcement (creator or admin)
export const updateAnnouncement = async (
  req: AuthRequest,
  res: Response
) => {
  const { title, content, priority } = req.body;

  try {
    const announcement = await pool.query(
      "SELECT created_by FROM announcements WHERE id = $1",
      [req.params.id]
    );

    if (announcement.rows.length === 0) {
      return res.status(404).json({ error: "Not found" });
    }

    const creatorId = announcement.rows[0].created_by;

    if (
      req.user?.id !== creatorId &&
      req.user?.role !== "admin"
    ) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const result = await pool.query(
      `UPDATE announcements
       SET title = $1, content = $2, priority = $3
       WHERE id = $4
       RETURNING *`,
      [title, content, priority, req.params.id]
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

