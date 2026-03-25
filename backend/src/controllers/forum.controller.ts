/**
 * Forum controller — handles posts, replies, and upvotes.
 * Any authenticated user can read and post. Only the creator,
 * educators, or admins can delete content.
 */

import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

// GET /api/forum — returns all posts with reply counts, upvote counts and author email.
// Supports an optional ?tag= query param to filter posts by a specific tag.
export const getPosts = async (req: AuthRequest, res: Response) => {
  try {
    // Check if the client wants to filter by a specific tag
    const { tag } = req.query;

    // Build the base query joining users for email, replies for count, and upvotes for count
    let query = `
      SELECT fp.*,
             u.email AS author_email,
             COUNT(DISTINCT fr.id) AS reply_count,
             COUNT(DISTINCT fup.id) AS upvote_count
      FROM forum_posts fp
      LEFT JOIN users u ON fp.created_by = u.id
      LEFT JOIN forum_replies fr ON fr.post_id = fp.id
      LEFT JOIN forum_upvotes fup ON fup.post_id = fp.id
    `;

    const params: any[] = [];

    // If a tag filter is supplied, add a WHERE clause that checks the tags array
    if (tag) {
      query += ` WHERE $1 = ANY(fp.tags)`;
      params.push(tag);
    }

    // Group by post ID and author email so the COUNT aggregates work correctly
    query += ` GROUP BY fp.id, u.email ORDER BY fp.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

// GET /api/forum/:id — returns a single post along with all its replies.
// Replies are ordered oldest first so conversations read naturally.
export const getPost = async (req: AuthRequest, res: Response) => {
  try {
    // Fetch the post with its upvote count and author email
    const postResult = await pool.query(
      `SELECT fp.*, u.email AS author_email,
              COUNT(DISTINCT fup.id) AS upvote_count
       FROM forum_posts fp
       LEFT JOIN users u ON fp.created_by = u.id
       LEFT JOIN forum_upvotes fup ON fup.post_id = fp.id
       WHERE fp.id = $1
       GROUP BY fp.id, u.email`,
      [req.params.id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Fetch all replies separately, oldest first so the thread reads in order
    const repliesResult = await pool.query(
      `SELECT fr.*, u.email AS author_email
       FROM forum_replies fr
       LEFT JOIN users u ON fr.created_by = u.id
       WHERE fr.post_id = $1
       ORDER BY fr.created_at ASC`,
      [req.params.id]
    );

    // Return post and replies together so the frontend gets everything in one call
    res.json({
      post: postResult.rows[0],
      replies: repliesResult.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
};

// POST /api/forum — creates a new forum post.
// Title and content are required. Tags are optional and default to an empty array.
export const createPost = async (req: AuthRequest, res: Response) => {
  const { title, content, tags } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required" });
  }

  // Make sure tags is always a clean array even if the client sent nothing
  const cleanTags: string[] = Array.isArray(tags) ? tags : [];

  try {
    const result = await pool.query(
      `INSERT INTO forum_posts (title, content, tags, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, content, cleanTags, req.user?.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create post" });
  }
};

// DELETE /api/forum/:id — removes a post entirely.
// Only the original poster, admins, or educators can delete a post.
export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    // Look up who wrote this post before deciding if deletion is allowed
    const post = await pool.query(
      "SELECT created_by FROM forum_posts WHERE id = $1",
      [req.params.id]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Allow deletion if the requesting user wrote it, or if they're a moderator
    const isOwner = post.rows[0].created_by === req.user?.id;
    const canModerate = req.user?.role === "admin" || req.user?.role === "educator";

    if (!isOwner && !canModerate) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await pool.query("DELETE FROM forum_posts WHERE id = $1", [req.params.id]);
    res.json({ message: "Post deleted" });
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
};

// POST /api/forum/:id/replies — adds a reply to an existing post.
// Any authenticated user can reply.
export const addReply = async (req: AuthRequest, res: Response) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Reply content is required" });
  }

  try {
    // Link the reply to both the parent post and the author
    const result = await pool.query(
      `INSERT INTO forum_replies (post_id, content, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, content, req.user?.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to add reply" });
  }
};

// DELETE /api/forum/:id/replies/:replyId — removes a specific reply.
// Same rules as post deletion — owner, admin, or educator.
export const deleteReply = async (req: AuthRequest, res: Response) => {
  try {
    // Note: uses req.params.replyId, not req.params.id (which is the post ID)
    const reply = await pool.query(
      "SELECT created_by FROM forum_replies WHERE id = $1",
      [req.params.replyId]
    );

    if (reply.rows.length === 0) {
      return res.status(404).json({ error: "Reply not found" });
    }

    const isOwner = reply.rows[0].created_by === req.user?.id;
    const canModerate = req.user?.role === "admin" || req.user?.role === "educator";

    if (!isOwner && !canModerate) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await pool.query("DELETE FROM forum_replies WHERE id = $1", [req.params.replyId]);
    res.json({ message: "Reply deleted" });
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
};

// POST /api/forum/:id/upvote — toggles an upvote on a post.
// If the user has already upvoted, it removes their upvote (unlike).
// If they haven't, it adds one.
export const toggleUpvote = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const postId = req.params.id;

  try {
    // Check if this user has already upvoted this post
    const existing = await pool.query(
      "SELECT id FROM forum_upvotes WHERE post_id = $1 AND user_id = $2",
      [postId, userId]
    );

    if (existing.rows.length > 0) {
      // Already upvoted — remove it (toggle off)
      await pool.query(
        "DELETE FROM forum_upvotes WHERE post_id = $1 AND user_id = $2",
        [postId, userId]
      );
      res.json({ upvoted: false });
    } else {
      // Not yet upvoted — add it (toggle on)
      await pool.query(
        "INSERT INTO forum_upvotes (post_id, user_id) VALUES ($1, $2)",
        [postId, userId]
      );
      res.json({ upvoted: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Upvote failed" });
  }
};
