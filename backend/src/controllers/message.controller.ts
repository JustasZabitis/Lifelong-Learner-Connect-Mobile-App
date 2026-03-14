import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================
   GET MY CONVERSATIONS
   Only returns non-archived conversations
========================= */
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
         c.created_by AS broadcast_sender_id
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = $1
         AND cp.archived_at IS NULL
       ORDER BY last_message_at DESC NULLS LAST`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
};

/* =========================
   GET ARCHIVED CONVERSATIONS
   Returns only archived conversations for the user
========================= */
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
         AND cp.archived_at IS NOT NULL
       ORDER BY cp.archived_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch archived conversations" });
  }
};

/* =========================
   ARCHIVE (CLEAR) A CONVERSATION
   Hides it from the main list for this user only
   Messages are kept — can be restored
========================= */
export const archiveConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;

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

/* =========================
   UNARCHIVE A CONVERSATION
   Restores it back to the main list
========================= */
export const unarchiveConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;

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

/* =========================
   DELETE A CONVERSATION
   Permanently removes the user from the conversation.
   If no participants remain, deletes the conversation entirely.
========================= */
export const deleteConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;

    // Remove the user from the conversation
    await pool.query(
      `DELETE FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    // Check if anyone else is still in this conversation
    const remaining = await pool.query(
      `SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = $1`,
      [conversationId]
    );

    if (parseInt(remaining.rows[0].count) === 0) {
      // No one left — delete all messages and the conversation itself
      await pool.query(`DELETE FROM messages WHERE conversation_id = $1`, [conversationId]);
      await pool.query(`DELETE FROM conversations WHERE id = $1`, [conversationId]);
    }

    res.json({ message: "Conversation deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
};

/* =========================
   GET MESSAGES IN A CONVERSATION
========================= */
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;

    const membership = await pool.query(
      `SELECT 1 FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: "Not a participant" });
    }

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

/* =========================
   CHECK IF CONVERSATION IS BROADCAST
========================= */
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
      is_sender: convo.created_by === userId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get conversation info" });
  }
};

/* =========================
   START A DIRECT MESSAGE CONVERSATION
========================= */
export const startDirectConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { other_user_id } = req.body;

    if (!other_user_id) return res.status(400).json({ error: "other_user_id is required" });
    if (userId === other_user_id) return res.status(400).json({ error: "Cannot message yourself" });

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
      // If it was archived, unarchive it
      await pool.query(
        `UPDATE conversation_participants SET archived_at = NULL
         WHERE conversation_id = $1 AND user_id = $2`,
        [existing.rows[0].id, userId]
      );
      return res.json({ conversation_id: existing.rows[0].id, existing: true });
    }

    const convo = await pool.query(
      `INSERT INTO conversations (is_group, is_broadcast) VALUES (FALSE, FALSE) RETURNING id`
    );
    const conversationId = convo.rows[0].id;

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

/* =========================
   CREATE A GROUP CONVERSATION
========================= */
export const createGroupConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, participant_ids } = req.body;

    if (!name || !participant_ids || !Array.isArray(participant_ids)) {
      return res.status(400).json({ error: "name and participant_ids[] are required" });
    }

    const convo = await pool.query(
      `INSERT INTO conversations (name, is_group, is_broadcast) VALUES ($1, TRUE, FALSE) RETURNING id`,
      [name]
    );
    const conversationId = convo.rows[0].id;

    const allParticipants: number[] = Array.from(new Set([userId, ...participant_ids]));
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

/* =========================
   BROADCAST TO STUDENT GROUP
========================= */
export const broadcastToGroup = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== "educator" && userRole !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { student_group, message } = req.body;

    if (!student_group || !message) {
      return res.status(400).json({ error: "student_group and message are required" });
    }

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

    for (const learner of learners.rows) {
      const convo = await pool.query(
        `INSERT INTO conversations (name, is_group, is_broadcast, created_by)
         VALUES ($1, FALSE, TRUE, $2) RETURNING id`,
        [`📢 ${student_group}`, userId]
      );
      const conversationId = convo.rows[0].id;

      await pool.query(
        `INSERT INTO conversation_participants (conversation_id, user_id)
         VALUES ($1, $2), ($1, $3)`,
        [conversationId, userId, learner.id]
      );

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

/* =========================
   GET ALL USERS
========================= */
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
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