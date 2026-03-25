/**
 * Feature flag controller — lets admins turn app features on and off
 * without touching code. Any authenticated user can read the flags,
 * but only admins can change them.
 */

import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

// GET /api/features — returns all feature flags as both a key/value map
// and a flat list, so the frontend can use whichever format it needs
export const getFeatureFlags = async (_req: AuthRequest, res: Response) => {
  try {
    // Grab every flag row ordered by ID so the list stays consistent
    const result = await pool.query(
      `SELECT flag_key, enabled, label FROM feature_flags ORDER BY id ASC`
    );

    // Build two structures from the same rows:
    // flags = { announcements: true, messages: false, ... }
    // flagList = [{ flag_key, enabled, label }, ...]
    const flags: Record<string, boolean> = {};
    const flagList: { flag_key: string; enabled: boolean; label: string }[] = [];

    result.rows.forEach((row: any) => {
      // Add to the key/value map for quick lookups
      flags[row.flag_key] = row.enabled;
      // Also push the full row so the settings UI can render labels
      flagList.push(row);
    });

    res.json({ flags, flagList });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch feature flags" });
  }
};

// PUT /api/features — toggles a single feature flag on or off.
// Only admins are allowed to call this.
export const updateFeatureFlag = async (req: AuthRequest, res: Response) => {
  // Reject anyone who isn't an admin before doing anything else
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Only administrators can manage feature flags" });
  }

  // Pull the flag key and new enabled state from the request body
  const { flag_key, enabled } = req.body;

  // Both fields are required — flag_key must be a string, enabled must be boolean
  if (!flag_key || typeof enabled !== "boolean") {
    return res.status(400).json({ error: "flag_key and enabled (boolean) are required" });
  }

  try {
    // Update the flag in the database and also stamp the updated_at timestamp
    const result = await pool.query(
      `UPDATE feature_flags SET enabled = $1, updated_at = NOW() WHERE flag_key = $2 RETURNING *`,
      [enabled, flag_key]
    );

    // If no rows came back, the flag_key doesn't exist in the database
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Flag not found" });
    }

    // Return the updated flag row so the frontend can sync its state
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update feature flag" });
  }
};
