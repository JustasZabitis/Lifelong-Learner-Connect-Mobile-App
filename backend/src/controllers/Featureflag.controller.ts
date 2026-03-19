import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* =========================
   GET ALL FEATURE FLAGS
   Any authenticated user can read flags
========================= */
export const getFeatureFlags = async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT flag_key, enabled, label FROM feature_flags ORDER BY id ASC`
    );

    // Return as a simple key-value object for easy frontend consumption
    const flags: Record<string, boolean> = {};
    const flagList: { flag_key: string; enabled: boolean; label: string }[] = [];

    result.rows.forEach((row: any) => {
      flags[row.flag_key] = row.enabled;
      flagList.push(row);
    });

    res.json({ flags, flagList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch feature flags" });
  }
};

/* =========================
   UPDATE A FEATURE FLAG
   Admin only
========================= */
export const updateFeatureFlag = async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only administrators can manage feature flags" });
  }

  const { flag_key, enabled } = req.body;

  if (!flag_key || typeof enabled !== "boolean") {
    return res.status(400).json({ error: "flag_key and enabled (boolean) are required" });
  }

  try {
    const result = await pool.query(
      `UPDATE feature_flags SET enabled = $1, updated_at = NOW() WHERE flag_key = $2 RETURNING *`,
      [enabled, flag_key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Flag not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update feature flag" });
  }
};