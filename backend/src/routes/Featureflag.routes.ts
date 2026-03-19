import { Router } from "express";
import { getFeatureFlags, updateFeatureFlag } from "../controllers/Featureflag.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authMiddleware, getFeatureFlags);
router.put("/", authMiddleware, updateFeatureFlag);

export default router;