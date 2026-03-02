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

// ── Course Events (educator-created) ──
router.get("/events", authMiddleware, getEvents);
router.post("/events", authMiddleware, createEvent);
router.put("/events/:id", authMiddleware, updateEvent);
router.delete("/events/:id", authMiddleware, deleteEvent);

// ── Personal Reminders (private per-user) ──
router.get("/reminders", authMiddleware, getReminders);
router.post("/reminders", authMiddleware, createReminder);
router.delete("/reminders/:id", authMiddleware, deleteReminder);

export default router;