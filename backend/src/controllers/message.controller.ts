/**
 * Message controller — handles direct messages, group chats, and broadcast messages.
 * Conversations can be archived (hidden but kept) or deleted (permanently removed).
 * Educators and admins can broadcast to all learners at once.
 */

import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

// GET /api/messages/conversations — returns all active (non-archived) conversations
// for the current user, with the last message preview and timestamp for each.
export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.is_group,
         c.is_broadcast,
         c.created_at,
         -- Subquery to get the most recent message text for the preview
         (
           SELECT m.content
           FROM messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.created_at DESC
           LIMIT 1
         ) AS last_message,
         -- Subquery to get the timestamp of the last message for sorting
         (
           SELECT m.created_at
           FROM messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.created_at DESC
           LIMIT 1
         ) AS last_message_at,
         -- Subquery to get the other person's email (for 1-to-1 chats)
         (
           SELECT u.email
           FROM conversation_participants cp2
           JOIN users u ON u.id = cp2.user_id
           WHERE cp2.conversation_id = c.id
             AND cp2.user_id != $1
           LIMIT 1
         ) AS other_user_email,
         c.created_by AS broadcast_sender_id
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = $1
         AND cp.archived_at IS NULL   -- only show non-archived conversations
       ORDER BY last_message_at DESC NULLS LAST`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

// GET /api/messages/conversations/archived — same as above but only returns
// conversations the user has archived (hidden from their main list).
export const getArchivedConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.is_group,
         c.is_broadcast,
         c.created_at,
         (
           SELECT m.content
           FROM messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.created_at DESC
           LIMIT 1
         ) AS last_message,
         (
           SELECT m.created_at
           FROM messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.created_at DESC
           LIMIT 1
         ) AS last_message_at,
         (
           SELECT u.email
           FROM conversation_participants cp2
           JOIN users u ON u.id = cp2.user_id
           WHERE cp2.conversation_id = c.id
             AND cp2.user_id != $1
           LIMIT 1
         ) AS other_user_email,
         cp.archived_at
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = $1
         AND cp.archived_at IS NOT NULL   -- only archived conversations
       ORDER BY cp.archived_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch archived conversations" });
  }
};

// PUT /api/messages/conversations/:id/archive — hides a conversation from the main list.
// Messages are kept intact — the user can restore it later via unarchive.
export const archiveConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;

    // Set archived_at for this specific user — other participants aren't affected
    await pool.query(
      `UPDATE conversation_participants
       SET archived_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    res.json({ message: "Conversation archived" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to archive conversation" });
  }
};

// PUT /api/messages/conversations/:id/unarchive — moves the conversation back to the main list.
export const unarchiveConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;

    // Clearing archived_at makes the conversation visible in the main list again
    await pool.query(
      `UPDATE conversation_participants
       SET archived_at = NULL
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    res.json({ message: "Conversation restored" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to unarchive conversation" });
  }
};

// DELETE /api/messages/conversations/:id — permanently removes this user from the conversation.
// If no other participants remain after removal, the whole conversation and its messages are deleted.
export const deleteConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;

    // Remove this user's participant record — they won't see the conversation anymore
    await pool.query(
      `DELETE FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    // Check if anyone else is still in the conversation
    const remaining = await pool.query(
      `SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = $1`,
      [conversationId]
    );

    // If everyone has left, clean up the messages and conversation record
    if (parseInt(remaining.rows[0].count) === 0) {
      await pool.query(`DELETE FROM messages WHERE conversation_id = $1`, [conversationId]);
      await pool.query(`DELETE FROM conversations WHERE id = $1`, [conversationId]);
    }

    res.json({ message: "Conversation deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
};

// GET /api/messages/conversations/:id/messages — returns all messages in a conversation,
// oldest first. Verifies the requesting user is actually a participant before returning anything.
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;

    // Security check: make sure this user is a member of the conversation
    const membership = await pool.query(
      `SELECT 1 FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: "Not a participant" });
    }

    // Return messages with sender email so the UI knows who said what
    const result = await pool.query(
      `SELECT
         m.id,
         m.content,
         m.created_at,
         m.sender_id,
         u.email AS sender_email
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

// GET /api/messages/conversations/:id/info — returns metadata about a conversation.
// The frontend uses this to know if it's a broadcast (read-only for students)
// and whether the current user is the one who created it.
export const getConversationInfo = async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT is_broadcast, created_by FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const convo = result.rows[0];
    res.json({
      is_broadcast: convo.is_broadcast || false,
      // is_sender lets the UI decide whether to show a reply input or not
      is_sender: convo.created_by === userId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get conversation info" });
  }
};

// POST /api/messages/conversations/direct — starts a direct message thread between two users.
// If a thread already exists between them, it just unarchives it instead of creating a duplicate.
export const startDirectConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { other_user_id } = req.body;

    if (!other_user_id) return res.status(400).json({ error: "other_user_id is required" });
    if (userId === other_user_id) return res.status(400).json({ error: "Cannot message yourself" });

    // Check if these two users already have a direct (non-group, non-broadcast) conversation
    const existing = await pool.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
       JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
       WHERE c.is_group = FALSE AND (c.is_broadcast = FALSE OR c.is_broadcast IS NULL)
       LIMIT 1`,
      [userId, other_user_id]
    );

    if (existing.rows.length > 0) {
      // If they had archived it, unarchive it so it shows back up in their list
      await pool.query(
        `UPDATE conversation_participants SET archived_at = NULL
         WHERE conversation_id = $1 AND user_id = $2`,
        [existing.rows[0].id, userId]
      );
      return res.json({ conversation_id: existing.rows[0].id, existing: true });
    }

    // No existing thread — create a new one-to-one conversation
    const convo = await pool.query(
      `INSERT INTO conversations (is_group, is_broadcast) VALUES (FALSE, FALSE) RETURNING id`
    );
    const conversationId = convo.rows[0].id;

    // Add both participants in one query
    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
      [conversationId, userId, other_user_id]
    );

    res.status(201).json({ conversation_id: conversationId, existing: false });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to start conversation" });
  }
};

// POST /api/messages/conversations/group — creates a named group chat.
// The creator is automatically included as a participant even if they forget to add themselves.
export const createGroupConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, participant_ids } = req.body;

    if (!name || !participant_ids || !Array.isArray(participant_ids)) {
      return res.status(400).json({ error: "name and participant_ids[] are required" });
    }

    // Create the group conversation record
    const convo = await pool.query(
      `INSERT INTO conversations (name, is_group, is_broadcast) VALUES ($1, TRUE, FALSE) RETURNING id`,
      [name]
    );
    const conversationId = convo.rows[0].id;

    // Deduplicate participants and make sure the creator is always in the list
    const allParticipants: number[] = Array.from(new Set([userId, ...participant_ids]));
    // Build parameterized VALUES list dynamically: ($1, $2), ($1, $3), ($1, $4)...
    const values = allParticipants.map((_, i) => `($1, $${i + 2})`).join(", ");

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${values}`,
      [conversationId, ...allParticipants]
    );

    res.status(201).json({ conversation_id: conversationId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create group conversation" });
  }
};

// POST /api/messages/conversations/broadcast — sends a message to every learner in the system.
// Only educators and admins can broadcast. Each learner gets their own private
// broadcast thread so they can't see each other's responses.
export const broadcastToGroup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Reject students trying to broadcast
    if (userRole !== "educator" && userRole !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { student_group, message } = req.body;

    if (!student_group || !message) {
      return res.status(400).json({ error: "student_group and message are required" });
    }

    // Get every learner (non-staff) except the sender themselves
    const learners = await pool.query(
      `SELECT id FROM users
       WHERE id != $1 AND role NOT IN ('educator', 'admin')
       ORDER BY id`,
      [userId]
    );

    if (learners.rows.length === 0) {
      return res.status(404).json({ error: "No learners found" });
    }

    let count = 0;

    // For each learner, create a separate broadcast conversation and drop the message in
    for (const learner of learners.rows) {
      const convo = await pool.query(
        `INSERT INTO conversations (name, is_group, is_broadcast, created_by)
         VALUES ($1, FALSE, TRUE, $2) RETURNING id`,
        [`📢 ${student_group}`, userId]
      );
      const conversationId = convo.rows[0].id;

      // Both the sender and the learner are participants
      await pool.query(
        `INSERT INTO conversation_participants (conversation_id, user_id)
         VALUES ($1, $2), ($1, $3)`,
        [conversationId, userId, learner.id]
      );

      // Insert the broadcast message from the sender
      await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3)`,
        [conversationId, userId, message]
      );

      count++;
    }

    res.status(201).json({ sent_to: count, student_group });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to broadcast to group" });
  }
};

// GET /api/messages/users — returns all users except the current one.
// Used by the "New Message" picker so you can search for someone to message.
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Exclude the current user so you don't appear in your own contact list
    const result = await pool.query(
      `SELECT id, email, role FROM users WHERE id != $1 ORDER BY email ASC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};
