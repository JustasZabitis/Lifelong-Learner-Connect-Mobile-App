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

router.get("/", authMiddleware, getCompetitions);
router.get("/:id", authMiddleware, getCompetition);
router.post("/", authMiddleware, createCompetition);
router.put("/:id/status", authMiddleware, updateCompetitionStatus);
router.delete("/:id", authMiddleware, deleteCompetition);
router.post("/:id/submit", authMiddleware, submitAttempt);
router.post("/:id/submit-words", authMiddleware, submitWordAttempt);
router.get("/:id/leaderboard", authMiddleware, getLeaderboard);

export default router;