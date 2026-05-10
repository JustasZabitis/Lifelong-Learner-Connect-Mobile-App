/**
 * Progress routes — student enrolment, completion tracking, badges, and programme lists.
 * Reading progress is open to all authenticated users (with ownership checks in controllers).
 * Modifying progress and awarding badges requires educator or admin role.
 */

import { Router } from "express";
import {
  getProgress,
  getProgressSummary,
  enrolStudent,
  updateProgress,
  getAllBadges,
  getMyBadges,
  awardBadge,
  getProgrammes,
} from "../controllers/progress.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// GET /api/progress — returns progress records for the current user (or ?user_id= for staff)
router.get("/", authMiddleware, getProgress);

// GET /api/progress/summary — returns dashboard stats (total courses, badges, micro-credentials)
router.get("/summary", authMiddleware, getProgressSummary);

// GET /api/progress/programmes — returns all programmes for dropdowns and pickers
router.get("/programmes", authMiddleware, getProgrammes);

// POST /api/progress/enrol — enrols a student in a programme (educators/admins only)
router.post("/enrol", authMiddleware, enrolStudent);

// PUT /api/progress/:id — updates completion %, grade, or status for a progress record
router.put("/:id", authMiddleware, updateProgress);

// GET /api/progress/badges — returns all available badges in the system
router.get("/badges", authMiddleware, getAllBadges);

// GET /api/progress/badges/mine — returns badges earned by the current user (or ?user_id= for staff)
router.get("/badges/mine", authMiddleware, getMyBadges);

// POST /api/progress/badges/award — awards a badge to a student (educators/admins only)
router.post("/badges/award", authMiddleware, awardBadge);

export default router;
