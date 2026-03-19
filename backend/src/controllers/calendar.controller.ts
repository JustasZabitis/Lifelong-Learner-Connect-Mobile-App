import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================
   GET EVENTS
   Educators/admins see all events.
   Students see events matching their group or ungrouped.
   Supports optional ?student_group and ?programme_name filters.
========================= */
export const getEvents = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const filterGroup = req.query.student_group as string | undefined;
    const filterProgramme = req.query.programme_name as string | undefined;

    let query = `
      SELECT e.*, u.email AS created_by_email
      FROM events e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    // students only see events targeted to them or to everyone
    if (role !== "educator" && role !== "admin") {
      query += ` AND (e.student_group IS NULL OR e.student_group = 'all' OR e.student_group = $${idx})`;
      params.push(role);
      idx++;
    }

    if (filterGroup && filterGroup !== "all") {
      query += ` AND e.student_group = $${idx}`;
      params.push(filterGroup);
      idx++;
    }

    if (filterProgramme) {
      query += ` AND e.programme_name ILIKE $${idx}`;
      params.push(`%${filterProgramme}%`);
      idx++;
    }

    query += ` ORDER BY e.event_date ASC, e.event_time ASC NULLS LAST`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
};

/* =========================
   CREATE EVENT
   Now accepts student_group and programme_name
========================= */
export const createEvent = async (req: AuthRequest, res: Response) => {
  const { title, description, event_date, event_time, type, role_target, student_group, programme_name } = req.body;

  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only educators and admins can create events" });
  }

  if (!title || !event_date) {
    return res.status(400).json({ error: "Title and event_date are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events
         (title, description, event_date, event_time, type, role_target, student_group, programme_name, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        title,
        description || null,
        event_date,
        event_time || null,
        type || "event",
        role_target || "all",
        student_group || null,
        programme_name || null,
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
   Creator can edit their own, educators/admins can edit any
========================= */
export const updateEvent = async (req: AuthRequest, res: Response) => {
  const { title, description, event_date, event_time, type, role_target, student_group, programme_name } = req.body;

  try {
    const existing = await pool.query("SELECT created_by FROM events WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Event not found" });

    const isCreator = req.user?.id === existing.rows[0].created_by;
    const isStaff = req.user?.role === "educator" || req.user?.role === "admin";

    if (!isCreator && !isStaff) {
      return res.status(403).json({ error: "Not authorized to edit this event" });
    }

    const result = await pool.query(
      `UPDATE events SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         event_date = COALESCE($3, event_date),
         event_time = COALESCE($4, event_time),
         type = COALESCE($5, type),
         role_target = COALESCE($6, role_target),
         student_group = COALESCE($7, student_group),
         programme_name = COALESCE($8, programme_name)
       WHERE id = $9 RETURNING *`,
      [title, description, event_date, event_time, type, role_target, student_group, programme_name, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update event" });
  }
};

/* =========================
   DELETE EVENT
========================= */
export const deleteEvent = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await pool.query("SELECT created_by FROM events WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Event not found" });

    const isCreator = req.user?.id === existing.rows[0].created_by;
    const isStaff = req.user?.role === "educator" || req.user?.role === "admin";

    if (!isCreator && !isStaff) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await pool.query("DELETE FROM events WHERE id = $1", [req.params.id]);
    res.json({ message: "Event deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete event" });
  }
};

/* =========================
   PERSONAL REMINDERS
========================= */
export const getReminders = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM personal_reminders WHERE user_id = $1 ORDER BY reminder_date ASC, reminder_time ASC NULLS LAST`,
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
  if (!title || !reminder_date) return res.status(400).json({ error: "Title and date required" });

  try {
    const result = await pool.query(
      `INSERT INTO personal_reminders (user_id, title, reminder_date, reminder_time) VALUES ($1, $2, $3, $4) RETURNING *`,
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
    await pool.query("DELETE FROM personal_reminders WHERE id = $1 AND user_id = $2", [req.params.id, req.user?.id]);
    res.json({ message: "Reminder deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete reminder" });
  }
};