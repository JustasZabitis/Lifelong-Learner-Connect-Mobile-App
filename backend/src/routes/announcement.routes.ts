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

router.get("/", authMiddleware, getAnnouncements);
router.post("/", authMiddleware, createAnnouncement);
router.delete("/:id", authMiddleware, deleteAnnouncement);
router.post("/:id/read", authMiddleware, markAsRead);
router.put("/:id", authMiddleware, updateAnnouncement);


export default router;