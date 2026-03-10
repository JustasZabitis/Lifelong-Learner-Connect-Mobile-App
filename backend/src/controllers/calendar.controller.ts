import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================
   GET EVENTS
   Returns all events visible to the logged-in user's role.
   Same targeting logic as announcements.
========================= */
export const getEvents = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;

    const result = await pool.query(
      `SELECT
         e.*,
         u.email AS created_by_email
       FROM events e
       LEFT JOIN users u ON u.id = e.created_by
       WHERE e.role_target = 'all' OR e.role_target = $1
       ORDER BY e.event_date ASC, e.event_time ASC NULLS LAST`,
      [role]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
};

/* =========================
   CREATE EVENT
   Educators and admins can create events.
========================= */
export const createEvent = async (req: AuthRequest, res: Response) => {
  const { title, description, event_date, event_time, type, role_target } =
    req.body;

  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only educators and admins can create events" });
  }

  if (!title || !event_date) {
    return res.status(400).json({ error: "Title and event_date are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events
         (title, description, event_date, event_time, type, role_target, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        title,
        description || null,
        event_date,
        event_time || null,
        type || "event",
        role_target || "all",
        req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create event" });
  }
};

/* =========================
   UPDATE EVENT
   - The creator can always edit their own event
   - Educators and admins can edit any event
========================= */
export const updateEvent = async (req: AuthRequest, res: Response) => {
  const { title, description, event_date, event_time, type, role_target } =
    req.body;

  try {
    const existing = await pool.query(
      "SELECT created_by FROM events WHERE id = $1",
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const isCreator = req.user?.id === existing.rows[0].created_by;
    const isEducatorOrAdmin =
      req.user?.role === "educator" || req.user?.role === "admin";

    if (!isCreator && !isEducatorOrAdmin) {
      return res.status(403).json({ error: "Not authorized to edit this event" });
    }

    const result = await pool.query(
      `UPDATE events
       SET title = $1,
           description = $2,
           event_date = $3,
           event_time = $4,
           type = $5,
           role_target = $6
       WHERE id = $7
       RETURNING *`,
      [title, description, event_date, event_time, type, role_target, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update event" });
  }
};

/* =========================
   DELETE EVENT
   - Educators and admins can delete any event
========================= */
export const deleteEvent = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await pool.query(
      "SELECT created_by FROM events WHERE id = $1",
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const isCreator = req.user?.id === existing.rows[0].created_by;
    const isEducatorOrAdmin =
      req.user?.role === "educator" || req.user?.role === "admin";

    if (!isCreator && !isEducatorOrAdmin) {
      return res.status(403).json({ error: "Not authorized to delete this event" });
    }

    await pool.query("DELETE FROM events WHERE id = $1", [req.params.id]);

    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete event" });
  }
};


/* =====================================================
   PERSONAL REMINDERS
   Private per-user reminders — only visible to creator
===================================================== */

export const getReminders = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM personal_reminders
       WHERE user_id = $1
       ORDER BY reminder_date ASC, reminder_time ASC NULLS LAST`,
      [req.user?.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch reminders" });
  }
};

export const createReminder = async (req: AuthRequest, res: Response) => {
  const { title, reminder_date, reminder_time } = req.body;

  if (!title || !reminder_date) {
    return res.status(400).json({ error: "Title and reminder_date are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO personal_reminders (user_id, title, reminder_date, reminder_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user?.id, title, reminder_date, reminder_time || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create reminder" });
  }
};

export const deleteReminder = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await pool.query(
      "SELECT user_id FROM personal_reminders WHERE id = $1",
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Reminder not found" });
    }

    if (req.user?.id !== existing.rows[0].user_id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await pool.query("DELETE FROM personal_reminders WHERE id = $1", [
      req.params.id,
    ]);

    res.json({ message: "Reminder deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete reminder" });
  }
};