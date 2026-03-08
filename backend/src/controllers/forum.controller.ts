import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================
   GET ALL POSTS
   Includes reply count, upvote count, author email, tags
========================= */
export const getPosts = async (req: AuthRequest, res: Response) => {
  try {
    // optional tag filter from query string e.g. ?tag=question
    const { tag } = req.query;

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

    if (tag) {
      query += ` WHERE $1 = ANY(fp.tags)`;
      params.push(tag);
    }

    query += ` GROUP BY fp.id, u.email ORDER BY fp.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

/* =========================
   GET SINGLE POST WITH REPLIES
========================= */
export const getPost = async (req: AuthRequest, res: Response) => {
  try {
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

    const repliesResult = await pool.query(
      `SELECT fr.*, u.email AS author_email
       FROM forum_replies fr
       LEFT JOIN users u ON fr.created_by = u.id
       WHERE fr.post_id = $1
       ORDER BY fr.created_at ASC`,
      [req.params.id]
    );

    res.json({
      post: postResult.rows[0],
      replies: repliesResult.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
};

/* =========================
   CREATE POST
   Accepts optional tags array
========================= */
export const createPost = async (req: AuthRequest, res: Response) => {
  const { title, content, tags } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: "Title and content are required" });
  }

  // make sure tags is always a clean array of strings
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

/* =========================
   DELETE POST
   Only the creator or admin can delete
========================= */
export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    const post = await pool.query(
      "SELECT created_by FROM forum_posts WHERE id = $1",
      [req.params.id]
    );

    if (post.rows.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

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

/* =========================
   ADD REPLY
========================= */
export const addReply = async (req: AuthRequest, res: Response) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Reply content is required" });
  }

  try {
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

/* =========================
   DELETE REPLY
   Only the creator or admin can delete
========================= */
export const deleteReply = async (req: AuthRequest, res: Response) => {
  try {
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

/* =========================
   TOGGLE UPVOTE
   Adds or removes upvote for the current user
========================= */
export const toggleUpvote = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const postId = req.params.id;

  try {
    const existing = await pool.query(
      "SELECT id FROM forum_upvotes WHERE post_id = $1 AND user_id = $2",
      [postId, userId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        "DELETE FROM forum_upvotes WHERE post_id = $1 AND user_id = $2",
        [postId, userId]
      );
      res.json({ upvoted: false });
    } else {
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