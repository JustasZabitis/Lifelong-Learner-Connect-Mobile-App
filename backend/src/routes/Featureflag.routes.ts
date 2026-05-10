/**
 * Feature flag routes — lets the frontend read all flags and admins toggle them.
 * Both routes require authentication; the admin check is enforced in the controller.
 */

import { Router } from "express";
import { getFeatureFlags, updateFeatureFlag } from "../controllers/Featureflag.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// GET /api/features — returns all feature flags (any authenticated user)
router.get("/", authMiddleware, getFeatureFlags);

// PUT /api/features — toggles a feature flag on or off (admin only, enforced in controller)
router.put("/", authMiddleware, updateFeatureFlag);

export default router;
