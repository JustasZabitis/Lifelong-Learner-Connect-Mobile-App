import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

export const getAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const isStaff = role === "educator" || role === "admin";
    const groupFilter = req.query.student_group as string | undefined;

    let query: string;
    const params: any[] = [];

    if (isStaff) {
      if (groupFilter && groupFilter !== "all") {
        query = `SELECT a.*, COUNT(ar.id) AS read_count FROM announcements a LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id WHERE a.student_group = $1 GROUP BY a.id ORDER BY a.created_at DESC`;
        params.push(groupFilter);
      } else {
        query = `SELECT a.*, COUNT(ar.id) AS read_count FROM announcements a LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id GROUP BY a.id ORDER BY a.created_at DESC`;
      }
    } else {
      query = `SELECT a.*, COUNT(ar.id) AS read_count FROM announcements a LEFT JOIN announcement_reads ar ON a.id = ar.announcement_id WHERE a.role_target = $1 OR a.role_target = 'all' OR a.programme_name IS NOT NULL GROUP BY a.id ORDER BY a.created_at DESC`;
      params.push(role);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
};

// now accepts student_group OR programme_name — mutually exclusive
export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  const { title, content, priority, role_target, student_group, programme_name } = req.body;
  if (req.user?.role !== "educator" && req.user?.role !== "admin") return res.status(403).json({ error: "Not authorized" });

  try {
    const result = await pool.query(
      `INSERT INTO announcements (title, content, priority, role_target, student_group, programme_name, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, content, priority || "medium", role_target || "all", student_group || null, programme_name || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ error: "Failed to create announcement" }); }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const a = await pool.query("SELECT created_by FROM announcements WHERE id = $1", [req.params.id]);
    if (a.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const isCreator = req.user?.id === a.rows[0].created_by;
    const isStaff = req.user?.role === "educator" || req.user?.role === "admin";
    if (!isCreator && !isStaff) return res.status(403).json({ error: "Not authorized" });
    await pool.query("DELETE FROM announcements WHERE id = $1", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (error) { res.status(500).json({ error: "Delete failed" }); }
};

export const updateAnnouncement = async (req: AuthRequest, res: Response) => {
  const { title, content, priority, student_group, programme_name } = req.body;
  try {
    const a = await pool.query("SELECT created_by FROM announcements WHERE id = $1", [req.params.id]);
    if (a.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const isCreator = req.user?.id === a.rows[0].created_by;
    const isStaff = req.user?.role === "educator" || req.user?.role === "admin";
    if (!isCreator && !isStaff) return res.status(403).json({ error: "Not authorized" });
    const result = await pool.query(
      `UPDATE announcements SET title=$1, content=$2, priority=$3, student_group=$4, programme_name=$5 WHERE id=$6 RETURNING *`,
      [title, content, priority, student_group || null, programme_name || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: "Update failed" }); }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(`INSERT INTO announcement_reads (announcement_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [req.params.id, req.user?.id]);
    res.json({ message: "Marked as read" });
  } catch (error) { console.error(error); res.status(500).json({ error: "Failed to mark as read" }); }
};