/**
 * Announcement routes — CRUD for course announcements.
 * All routes require authentication. Role-based access is enforced in the controller.
 */

import { Router } from "express";
import {
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  markAsRead,
  updateAnnouncement,
} from "../controllers/announcement.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// GET /api/announcements — returns announcements visible to the current user
router.get("/", authMiddleware, getAnnouncements);

// POST /api/announcements — creates a new announcement (educators/admins only)
router.post("/", authMiddleware, createAnnouncement);

// DELETE /api/announcements/:id — removes an announcement (creator or staff only)
router.delete("/:id", authMiddleware, deleteAnnouncement);

// POST /api/announcements/:id/read — marks an announcement as read for this user
router.post("/:id/read", authMiddleware, markAsRead);

// PUT /api/announcements/:id — updates an existing announcement (creator or staff only)
router.put("/:id", authMiddleware, updateAnnouncement);

export default router;
