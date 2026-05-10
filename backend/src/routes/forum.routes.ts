/**
 * Forum routes — community discussion board with posts, replies, and upvotes.
 * Any authenticated user can read and create; only creators/staff can delete.
 */

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

// GET /api/forum — returns all posts (supports optional ?tag= filter)
router.get("/", authMiddleware, getPosts);

// GET /api/forum/:id — returns a single post with all its replies
router.get("/:id", authMiddleware, getPost);

// POST /api/forum — creates a new discussion post
router.post("/", authMiddleware, createPost);

// DELETE /api/forum/:id — removes a post (owner, educator, or admin only)
router.delete("/:id", authMiddleware, deletePost);

// POST /api/forum/:id/replies — adds a reply to a post
router.post("/:id/replies", authMiddleware, addReply);

// DELETE /api/forum/:id/replies/:replyId — removes a specific reply
router.delete("/:id/replies/:replyId", authMiddleware, deleteReply);

// POST /api/forum/:id/upvote — toggles your upvote on a post (adds or removes)
router.post("/:id/upvote", authMiddleware, toggleUpvote);

export default router;
