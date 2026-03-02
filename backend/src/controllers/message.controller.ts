import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================
   GET MY CONVERSATIONS
   Returns all conversations the logged-in user is part of,
   including the last message sent in each one
========================= */
export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const result = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.is_group,
         c.created_at,
         -- Get the most recent message content
         (
           SELECT m.content
           FROM messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.created_at DESC
           LIMIT 1
         ) AS last_message,
         -- Get the most recent message time
         (
           SELECT m.created_at
           FROM messages m
           WHERE m.conversation_id = c.id
           ORDER BY m.created_at DESC
           LIMIT 1
         ) AS last_message_at,
         -- For direct messages: get the OTHER person's email as the display name
         (
           SELECT u.email
           FROM conversation_participants cp2
           JOIN users u ON u.id = cp2.user_id
           WHERE cp2.conversation_id = c.id
             AND cp2.user_id != $1
           LIMIT 1
         ) AS other_user_email
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = $1
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
   GET MESSAGES IN A CONVERSATION
   Returns all messages + sender email for a given conversation.
   Only works if the logged-in user is a participant.
========================= */
export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = req.params.id;

    // Make sure the user is actually in this conversation
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
   START A DIRECT MESSAGE CONVERSATION
   Creates a new 1-to-1 conversation between two users.
   If one already exists between them, returns that instead.
========================= */
export const startDirectConversation = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    const { other_user_id } = req.body;

    if (!other_user_id) {
      return res.status(400).json({ error: "other_user_id is required" });
    }

    if (userId === other_user_id) {
      return res.status(400).json({ error: "Cannot message yourself" });
    }

    // Check if a direct conversation already exists between these two users
    const existing = await pool.query(
      `SELECT c.id
       FROM conversations c
       JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
       JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
       WHERE c.is_group = FALSE
       LIMIT 1`,
      [userId, other_user_id]
    );

    if (existing.rows.length > 0) {
      return res.json({ conversation_id: existing.rows[0].id, existing: true });
    }

    // Create new conversation
    const convo = await pool.query(
      `INSERT INTO conversations (is_group) VALUES (FALSE) RETURNING id`
    );
    const conversationId = convo.rows[0].id;

    // Add both users as participants
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
   Creates a named group chat and adds all listed user IDs
========================= */
export const createGroupConversation = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const userId = req.user?.id;
    const { name, participant_ids } = req.body;

    if (!name || !participant_ids || !Array.isArray(participant_ids)) {
      return res.status(400).json({ error: "name and participant_ids[] are required" });
    }

    // Create the group conversation
    const convo = await pool.query(
      `INSERT INTO conversations (name, is_group) VALUES ($1, TRUE) RETURNING id`,
      [name]
    );
    const conversationId = convo.rows[0].id;

    // Build participant list — always include the creator
    const allParticipants: number[] = Array.from(
      new Set([userId, ...participant_ids])
    );

    // Insert all participants in one query
    const values = allParticipants
      .map((_, i) => `($1, $${i + 2})`)
      .join(", ");

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
   GET ALL USERS
   Used in the frontend to let users search/select who to message
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