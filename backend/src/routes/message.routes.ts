/**
 * Message routes — direct messages, group chats, broadcasts, and archive management.
 * All routes require authentication. Broadcast is restricted to educators/admins in the controller.
 */

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

// GET /api/messages/conversations — returns all active (non-archived) conversations
router.get("/conversations", authMiddleware, getConversations);

// GET /api/messages/conversations/archived — returns conversations the user has archived
router.get("/conversations/archived", authMiddleware, getArchivedConversations);

// GET /api/messages/conversations/:id/messages — returns all messages in a conversation
router.get("/conversations/:id/messages", authMiddleware, getMessages);

// GET /api/messages/conversations/:id/info — returns broadcast status and sender info
router.get("/conversations/:id/info", authMiddleware, getConversationInfo);

// POST /api/messages/conversations/direct — starts a 1-to-1 conversation (or reopens an archived one)
router.post("/conversations/direct", authMiddleware, startDirectConversation);

// POST /api/messages/conversations/group — creates a named group chat
router.post("/conversations/group", authMiddleware, createGroupConversation);

// POST /api/messages/conversations/broadcast — sends a message to every learner (educators/admins only)
router.post("/conversations/broadcast", authMiddleware, broadcastToGroup);

// PUT /api/messages/conversations/:id/archive — hides a conversation (keeps messages)
router.put("/conversations/:id/archive", authMiddleware, archiveConversation);

// PUT /api/messages/conversations/:id/unarchive — restores a conversation to the main list
router.put("/conversations/:id/unarchive", authMiddleware, unarchiveConversation);

// DELETE /api/messages/conversations/:id — permanently removes this user from the conversation
router.delete("/conversations/:id", authMiddleware, deleteConversation);

// GET /api/messages/users — returns all users for the "New Message" contact picker
router.get("/users", authMiddleware, getAllUsers);

export default router;
