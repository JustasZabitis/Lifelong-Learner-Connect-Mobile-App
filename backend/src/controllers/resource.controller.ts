import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";
import fs from "fs";
import path from "path";

/* =========================
   GET RESOURCES
   Returns all resources visible to the logged-in user's role.
========================= */
export const getResources = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;

    // educators and admins see everything so they can manage all content
    // learners only see files targeted at their role or at everyone
    const result = await pool.query(
      `SELECT
         r.*,
         u.email AS created_by_email
       FROM resources r
       LEFT JOIN users u ON u.id = r.created_by
       WHERE $1 IN ('educator', 'admin')
          OR r.role_target = 'all'
          OR r.role_target = $1
       ORDER BY r.created_at DESC`,
      [role]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
};

/* =========================
   UPLOAD RESOURCE
   Educators and admins can upload.
========================= */
export const uploadResource = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: "Only educators and admins can upload resources" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { title, description, category, role_target } = req.body;

  if (!title) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO resources
         (title, description, file_name, file_path, file_type, file_size, category, role_target, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        title,
        description || null,
        req.file.originalname,
        req.file.path,
        req.file.mimetype,
        req.file.size,
        category || "general",
        role_target || "all",
        req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to save resource" });
  }
};

/* =========================
   DOWNLOAD / SERVE A FILE
   Any authenticated user can download.
========================= */
export const downloadResource = async (req: AuthRequest, res: Response) => {
  try {
    const queryToken = req.query.token as string | undefined;
    if (queryToken && !req.user) {
      const jwt = await import("jsonwebtoken");
      try {
        const decoded = jwt.verify(
          queryToken,
          process.env.JWT_SECRET || "secret_key_ABCD_8673217853219853965321"
        );
        (req as any).user = decoded;
      } catch {
        return res.status(403).json({ error: "Invalid token" });
      }
    }

    if (!req.user) {
      return res.status(401).json({ error: "No token provided" });
    }

    const result = await pool.query(
      "SELECT * FROM resources WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const resource = result.rows[0];
    const filePath = path.resolve(resource.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${resource.file_name}"`
    );
    res.setHeader("Content-Type", resource.file_type);

    res.sendFile(filePath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to download file" });
  }
};

/* =========================
   DELETE RESOURCE
   Educators can delete their own files.
   Admins can delete any file.
========================= */
export const deleteResource = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM resources WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const resource = result.rows[0];
    const isCreator = req.user?.id === resource.created_by;
    const isAdmin = req.user?.role === "admin";
    const isEducator = req.user?.role === "educator";

    if (!isCreator && !isAdmin && !isEducator) {
      return res.status(403).json({ error: "Not authorized to delete this resource" });
    }

    await pool.query("DELETE FROM resources WHERE id = $1", [req.params.id]);

    const filePath = path.resolve(resource.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: "Resource deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete resource" });
  }
};