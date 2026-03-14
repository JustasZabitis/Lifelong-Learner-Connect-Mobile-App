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

router.get("/", authMiddleware, getProgress);
router.get("/summary", authMiddleware, getProgressSummary);
router.get("/programmes", authMiddleware, getProgrammes);
router.post("/enrol", authMiddleware, enrolStudent);
router.put("/:id", authMiddleware, updateProgress);
router.get("/badges", authMiddleware, getAllBadges);
router.get("/badges/mine", authMiddleware, getMyBadges);
router.post("/badges/award", authMiddleware, awardBadge);

export default router;