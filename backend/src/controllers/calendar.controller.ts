/**
 * Calendar controller — manages two types of calendar entries:
 * 1. Course Events: created by educators/admins, visible to students
 * 2. Personal Reminders: private per-user, only the owner can see them
 */

import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

// GET /api/calendar/events — returns upcoming events.
// Educators and admins see all events. Students only see events
// that are either for everyone or targeted at their specific group.
// Supports optional ?student_group and ?programme_name query filters.
export const getEvents = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const filterGroup = req.query.student_group as string | undefined;
    const filterProgramme = req.query.programme_name as string | undefined;

    // Start with a base query that joins the creator's email for display
    let query = `
      SELECT e.*, u.email AS created_by_email
      FROM events e
      LEFT JOIN users u ON u.id = e.created_by
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    // Students can only see events that are open to everyone
    // or specifically assigned to their student group
    if (role !== "educator" && role !== "admin") {
      query += ` AND (e.student_group IS NULL OR e.student_group = 'all' OR e.student_group = $${idx})`;
      params.push(role);
      idx++;
    }

    // Optional filter: staff can narrow down by a specific student group
    if (filterGroup && filterGroup !== "all") {
      query += ` AND e.student_group = $${idx}`;
      params.push(filterGroup);
      idx++;
    }

    // Optional filter: narrow by programme name using a case-insensitive partial match
    if (filterProgramme) {
      query += ` AND e.programme_name ILIKE $${idx}`;
      params.push(`%${filterProgramme}%`);
      idx++;
    }

    // Sort by date ascending, then time ascending — nulls (no specific time) go last
    query += ` ORDER BY e.event_date ASC, e.event_time ASC NULLS LAST`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
};

// POST /api/calendar/events — creates a new course event.
// Only educators and admins can create events. Title and date are required.
export const createEvent = async (req: AuthRequest, res: Response) => {
  const { title, description, event_date, event_time, type, role_target, student_group, programme_name } = req.body;

  // Reject students trying to create events
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only educators and admins can create events" });
  }

  // Title and date are the minimum required fields
  if (!title || !event_date) {
    return res.status(400).json({ error: "Title and event_date are required" });
  }

  try {
    // Insert the event with defaults where values aren't provided
    const result = await pool.query(
      `INSERT INTO events
         (title, description, event_date, event_time, type, role_target, student_group, programme_name, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        title,
        description || null,
        event_date,
        event_time || null,           // time is optional
        type || "event",              // defaults to generic "event" type
        role_target || "all",         // defaults to visible to everyone
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

// PUT /api/calendar/events/:id — updates an existing event.
// The creator can edit their own events, educators and admins can edit any event.
// Uses COALESCE so only the fields you send get updated; others stay as-is.
export const updateEvent = async (req: AuthRequest, res: Response) => {
  const { title, description, event_date, event_time, type, role_target, student_group, programme_name } = req.body;

  try {
    // Check the event exists and grab who created it
    const existing = await pool.query("SELECT created_by FROM events WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Event not found" });

    // Allow edit if you own it, or if you're staff
    const isCreator = req.user?.id === existing.rows[0].created_by;
    const isStaff = req.user?.role === "educator" || req.user?.role === "admin";
    if (!isCreator && !isStaff) {
      return res.status(403).json({ error: "Not authorized to edit this event" });
    }

    // COALESCE means: use the new value if provided, otherwise keep the existing column value
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

// DELETE /api/calendar/events/:id — removes a course event.
// Same rules as update — creator or staff can delete.
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

// GET /api/calendar/reminders — returns the current user's personal reminders only.
// These are completely private — no one else can see them.
export const getReminders = async (req: AuthRequest, res: Response) => {
  try {
    // Filter strictly by user_id so reminders never leak between accounts
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

// POST /api/calendar/reminders — adds a new personal reminder for the logged-in user.
// Title and date are required; time is optional.
export const createReminder = async (req: AuthRequest, res: Response) => {
  const { title, reminder_date, reminder_time } = req.body;

  if (!title || !reminder_date) return res.status(400).json({ error: "Title and date required" });

  try {
    // Store the reminder linked to this user's ID
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

// DELETE /api/calendar/reminders/:id — removes a personal reminder.
// The WHERE clause includes both the reminder ID and the user's own ID,
// so users can never accidentally delete someone else's reminder.
export const deleteReminder = async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      "DELETE FROM personal_reminders WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user?.id]
    );
    res.json({ message: "Reminder deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete reminder" });
  }
};
