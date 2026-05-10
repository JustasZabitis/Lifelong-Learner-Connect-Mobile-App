/**
 * Resource controller for file uploads, downloads, and management.
 * Handles educational materials like PDFs, videos, presentations, etc.
 */

import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";
import fs from "fs";
import path from "path";

// Fetches resources visible to the current user based on their role and filters
export const getResources = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const filterGroup = req.query.student_group as string | undefined;
    const filterProgramme = req.query.programme_name as string | undefined;

    // Build query to fetch resources with creator email info
    let query = `SELECT r.*, u.email AS created_by_email FROM resources r LEFT JOIN users u ON u.id = r.created_by WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    // If user is not educator or admin, only show resources meant for them or marked public
    if (role !== "educator" && role !== "admin") {
      query += ` AND (r.student_group IS NULL OR r.student_group = 'all' OR r.student_group = $${idx})`;
      params.push(role);
      idx++;
    }

    // Apply optional student group filter
    if (filterGroup && filterGroup !== "all") {
      query += ` AND r.student_group = $${idx}`;
      params.push(filterGroup);
      idx++;
    }

    // Apply optional programme name filter (case-insensitive partial match)
    if (filterProgramme) {
      query += ` AND r.programme_name ILIKE $${idx}`;
      params.push(`%${filterProgramme}%`);
      idx++;
    }

    // Sort by creation date, newest first
    query += ` ORDER BY r.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
};

// Allows educators and admins to upload educational resources (files)
export const uploadResource = async (req: AuthRequest, res: Response) => {
  // Only educators and admins can upload resources
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: "Only educators and admins can upload resources" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { title, description, category, role_target, student_group, programme_name } = req.body;

  // Title is required for every resource
  if (!title) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    // Store resource metadata in database with file information
    const result = await pool.query(
      `INSERT INTO resources (title, description, file_name, file_path, file_type, file_size, category, role_target, student_group, programme_name, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [title, description || null, req.file.originalname, req.file.path, req.file.mimetype, req.file.size, category || "general", role_target || "all", student_group || null, programme_name || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    // Clean up uploaded file if database insert fails
    fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to save resource" });
  }
};

// Absolute path to the uploads directory — all served files must be inside this directory
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

// Whitelist of safe MIME types to serve.
// Files with types not in this list are served as "application/octet-stream" (generic download)
// to prevent the browser from executing or rendering potentially malicious content.
const SAFE_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/json",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
]);

// Securely serves a resource file with path traversal and content-type protection
export const downloadResource = async (req: AuthRequest, res: Response) => {
  try {
    // Look up the resource file information from database
    const result = await pool.query(
      "SELECT file_path, file_name, file_type FROM resources WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const { file_path, file_name, file_type } = result.rows[0];

    // Prevent path traversal attacks by verifying the file is inside UPLOADS_DIR.
    // Paths like "../../../etc/passwd" get resolved to their real location and rejected.
    const resolvedPath = path.resolve(file_path);
    if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep) &&
        resolvedPath !== UPLOADS_DIR) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Check that the file actually exists on disk before trying to serve it
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: "File not found on server" });
    }

    // Sanitize filename to prevent HTTP header injection attacks.
    // Only allow safe characters and cap length to prevent padding attacks.
    const safeFilename = (file_name as string)
      .replace(/[^\w\-. ]/g, "_")
      .substring(0, 100);

    // Only serve MIME types on the whitelist; unknown types become generic binary downloads.
    // This prevents the browser from rendering or executing potentially malicious HTML or JS files.
    const safeContentType = SAFE_MIME_TYPES.has(file_type)
      ? file_type
      : "application/octet-stream";

    // Use "attachment" instead of "inline" to force download rather than rendering,
    // which prevents execution of scripts in SVG or HTML files.
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename}"`
    );
    res.setHeader("Content-Type", safeContentType);

    // Stream the file contents to the response
    fs.createReadStream(resolvedPath).pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to download" });
  }
};

// Deletes a resource if the user is the creator, an educator, or an admin
export const deleteResource = async (req: AuthRequest, res: Response) => {
  try {
    // Fetch the resource to check ownership and file location
    const resource = await pool.query("SELECT * FROM resources WHERE id = $1", [req.params.id]);

    if (resource.rows.length === 0) {
      return res.status(404).json({ error: "Resource not found" });
    }

    // Check if user is authorized to delete (owner, educator, or admin)
    const isCreator = req.user?.id === resource.rows[0].created_by;
    const isAdmin = req.user?.role === "admin";
    const isEducator = req.user?.role === "educator";

    if (!isCreator && !isAdmin && !isEducator) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Delete the file from disk if it exists
    if (fs.existsSync(resource.rows[0].file_path)) {
      fs.unlinkSync(resource.rows[0].file_path);
    }

    // Delete the resource record from database
    await pool.query("DELETE FROM resources WHERE id = $1", [req.params.id]);
    res.json({ message: "Resource deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete resource" });
  }
};

// Fetches a list of all unique programme names from the programmes table
export const getProgrammeNames = async (_req: AuthRequest, res: Response) => {
  try {
    // Query distinct programme names sorted alphabetically
    const result = await pool.query(`SELECT DISTINCT programme_name FROM programmes WHERE programme_name IS NOT NULL ORDER BY programme_name ASC`);
    res.json(result.rows.map((r: any) => r.programme_name));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch programmes" });
  }
};