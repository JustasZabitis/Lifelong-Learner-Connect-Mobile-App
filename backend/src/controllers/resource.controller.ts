import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";
import fs from "fs";
import path from "path";

export const getResources = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const filterGroup = req.query.student_group as string | undefined;
    const filterProgramme = req.query.programme_name as string | undefined;

    let query = `SELECT r.*, u.email AS created_by_email FROM resources r LEFT JOIN users u ON u.id = r.created_by WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (role !== "educator" && role !== "admin") {
      query += ` AND (r.student_group IS NULL OR r.student_group = 'all' OR r.student_group = $${idx})`;
      params.push(role);
      idx++;
    }

    if (filterGroup && filterGroup !== "all") {
      query += ` AND r.student_group = $${idx}`;
      params.push(filterGroup);
      idx++;
    }

    if (filterProgramme) {
      query += ` AND r.programme_name ILIKE $${idx}`;
      params.push(`%${filterProgramme}%`);
      idx++;
    }

    query += ` ORDER BY r.created_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch resources" });
  }
};

export const uploadResource = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "educator" && req.user?.role !== "admin") {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: "Only educators and admins can upload resources" });
  }

  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { title, description, category, role_target, student_group, programme_name } = req.body;

  if (!title) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "Title is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO resources (title, description, file_name, file_path, file_type, file_size, category, role_target, student_group, programme_name, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [title, description || null, req.file.originalname, req.file.path, req.file.mimetype, req.file.size, category || "general", role_target || "all", student_group || null, programme_name || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Failed to save resource" });
  }
};

export const downloadResource = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query("SELECT file_path, file_name, file_type FROM resources WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Resource not found" });
    const { file_path, file_name, file_type } = result.rows[0];
    if (!fs.existsSync(file_path)) return res.status(404).json({ error: "File not found on server" });
    res.setHeader("Content-Disposition", `inline; filename="${file_name}"`);
    res.setHeader("Content-Type", file_type);
    fs.createReadStream(file_path).pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to download" });
  }
};

export const deleteResource = async (req: AuthRequest, res: Response) => {
  try {
    const resource = await pool.query("SELECT * FROM resources WHERE id = $1", [req.params.id]);
    if (resource.rows.length === 0) return res.status(404).json({ error: "Resource not found" });
    const isCreator = req.user?.id === resource.rows[0].created_by;
    const isAdmin = req.user?.role === "admin";
    const isEducator = req.user?.role === "educator";
    if (!isCreator && !isAdmin && !isEducator) return res.status(403).json({ error: "Not authorized" });
    if (fs.existsSync(resource.rows[0].file_path)) fs.unlinkSync(resource.rows[0].file_path);
    await pool.query("DELETE FROM resources WHERE id = $1", [req.params.id]);
    res.json({ message: "Resource deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete resource" });
  }
};

export const getProgrammeNames = async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`SELECT DISTINCT programme_name FROM programmes WHERE programme_name IS NOT NULL ORDER BY programme_name ASC`);
    res.json(result.rows.map((r: any) => r.programme_name));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch programmes" });
  }
};