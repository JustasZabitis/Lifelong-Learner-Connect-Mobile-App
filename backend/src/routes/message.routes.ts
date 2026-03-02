import { Router } from "express";
import {
  getConversations,
  getMessages,
  startDirectConversation,
  createGroupConversation,
  getAllUsers,
} from "../controllers/message.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Get all conversations for the logged-in user
router.get("/conversations", authMiddleware, getConversations);

// Get all messages inside a specific conversation
router.get("/conversations/:id/messages", authMiddleware, getMessages);

// Start a new direct (1-to-1) message conversation
router.post("/conversations/direct", authMiddleware, startDirectConversation);

// Create a new group conversation
router.post("/conversations/group", authMiddleware, createGroupConversation);

// Get all users (for the "New Message" user picker)
router.get("/users", authMiddleware, getAllUsers);

export default router;