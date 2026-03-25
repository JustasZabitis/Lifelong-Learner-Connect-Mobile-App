/**
 * Calendar routes — split into two sections:
 * 1. Course Events: created by staff, visible to students
 * 2. Personal Reminders: private per-user notes and reminders
 */

import { Router } from "express";
import {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getReminders,
  createReminder,
  deleteReminder,
} from "../controllers/calendar.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// ── Course Events (created by educators/admins) ────────────────────────────

// GET /api/calendar/events — returns events visible to the current user
router.get("/events", authMiddleware, getEvents);

// POST /api/calendar/events — creates a new course event (educators/admins only)
router.post("/events", authMiddleware, createEvent);

// PUT /api/calendar/events/:id — updates an event (creator or staff only)
router.put("/events/:id", authMiddleware, updateEvent);

// DELETE /api/calendar/events/:id — removes an event (creator or staff only)
router.delete("/events/:id", authMiddleware, deleteEvent);

// ── Personal Reminders (private to each user) ──────────────────────────────

// GET /api/calendar/reminders — returns only the current user's reminders
router.get("/reminders", authMiddleware, getReminders);

// POST /api/calendar/reminders — adds a new personal reminder
router.post("/reminders", authMiddleware, createReminder);

// DELETE /api/calendar/reminders/:id — removes a reminder (must be owned by the current user)
router.delete("/reminders/:id", authMiddleware, deleteReminder);

export default router;
