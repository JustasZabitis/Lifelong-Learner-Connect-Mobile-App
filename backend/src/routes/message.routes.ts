import { Router } from "express";
import {
  getConversations,
  getArchivedConversations,
  getMessages,
  getConversationInfo,
  startDirectConversation,
  createGroupConversation,
  broadcastToGroup,
  archiveConversation,
  unarchiveConversation,
  deleteConversation,
  getAllUsers,
} from "../controllers/message.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Get all active (non-archived) conversations
router.get("/conversations", authMiddleware, getConversations);

// Get archived conversations
router.get("/conversations/archived", authMiddleware, getArchivedConversations);

// Get all messages inside a specific conversation
router.get("/conversations/:id/messages", authMiddleware, getMessages);

// Get conversation info (broadcast status)
router.get("/conversations/:id/info", authMiddleware, getConversationInfo);

// Start a new direct (1-to-1) message conversation
router.post("/conversations/direct", authMiddleware, startDirectConversation);

// Create a new group conversation
router.post("/conversations/group", authMiddleware, createGroupConversation);

// Broadcast a message to a student group (educators/admins only)
router.post("/conversations/broadcast", authMiddleware, broadcastToGroup);

// Archive (clear) a conversation — hides from main list, keeps messages
router.put("/conversations/:id/archive", authMiddleware, archiveConversation);

// Unarchive — restore to main list
router.put("/conversations/:id/unarchive", authMiddleware, unarchiveConversation);

// Delete a conversation permanently for this user
router.delete("/conversations/:id", authMiddleware, deleteConversation);

// Get all users (for the "New Message" user picker)
router.get("/users", authMiddleware, getAllUsers);

export default router;