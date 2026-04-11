/**
 * Academic Year Management Routes
 * All routes require authentication (admin only — enforced in controllers).
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  getOverview,
  getStudents,
  graduateStudents,
  progressYear,
  sendNotification,
} from "../controllers/academicYear.controller";

const router = Router();

// GET /api/academic/overview — summary stats: students by year, alumni count, programmes
router.get("/overview", authMiddleware, getOverview);

// GET /api/academic/students — list students with optional filters
router.get("/students", authMiddleware, getStudents);

// POST /api/academic/graduate — mark students as alumni (with optional notification)
router.post("/graduate", authMiddleware, graduateStudents);

// POST /api/academic/progress-year — increment year level for selected students
router.post("/progress-year", authMiddleware, progressYear);

// POST /api/academic/notify — send custom in-app notification to selected students
router.post("/notify", authMiddleware, sendNotification);

export default router;
