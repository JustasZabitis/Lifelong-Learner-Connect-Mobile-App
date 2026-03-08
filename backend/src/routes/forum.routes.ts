import { Router } from "express";
import {
  getPosts,
  getPost,
  createPost,
  deletePost,
  addReply,
  deleteReply,
  toggleUpvote,
} from "../controllers/forum.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authMiddleware, getPosts);
router.get("/:id", authMiddleware, getPost);
router.post("/", authMiddleware, createPost);
router.delete("/:id", authMiddleware, deletePost);
router.post("/:id/replies", authMiddleware, addReply);
router.delete("/:id/replies/:replyId", authMiddleware, deleteReply);
router.post("/:id/upvote", authMiddleware, toggleUpvote);

export default router;