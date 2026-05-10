/**
 * Competition routes — quizzes, crosswords, and word searches.
 * Educators/admins manage competitions; students view and submit attempts.
 */

import { Router } from "express";
import {
  getCompetitions,
  getCompetition,
  createCompetition,
  updateCompetitionStatus,
  deleteCompetition,
  submitAttempt,
  submitWordAttempt,
  getLeaderboard,
} from "../controllers/competition.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// GET /api/competitions — returns all competitions visible to the current user
router.get("/", authMiddleware, getCompetitions);

// GET /api/competitions/:id — returns a single competition with questions or words
router.get("/:id", authMiddleware, getCompetition);

// POST /api/competitions — creates a new competition (educators/admins only)
router.post("/", authMiddleware, createCompetition);

// PUT /api/competitions/:id/status — changes competition status (draft/active/closed)
router.put("/:id/status", authMiddleware, updateCompetitionStatus);

// DELETE /api/competitions/:id — permanently removes a competition
router.delete("/:id", authMiddleware, deleteCompetition);

// POST /api/competitions/:id/submit — submits a quiz attempt and returns the score
router.post("/:id/submit", authMiddleware, submitAttempt);

// POST /api/competitions/:id/submit-words — submits a crossword or wordsearch attempt
router.post("/:id/submit-words", authMiddleware, submitWordAttempt);

// GET /api/competitions/:id/leaderboard — returns top 50 scores for a competition
router.get("/:id/leaderboard", authMiddleware, getLeaderboard);

export default router;
