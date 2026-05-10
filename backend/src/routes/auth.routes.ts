/**
 * Authentication routes for user registration, login, logout, and session management.
 */

import { Router } from "express";
import { register, login, logout, me } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// POST /api/auth/register — creates a new user account
router.post("/register", register);

// POST /api/auth/login — authenticates user and returns JWT token
router.post("/login", login);

// POST /api/auth/logout — clears httpOnly cookie on browser
router.post("/logout", logout);

// GET /api/auth/me — returns current user info (requires valid token)
router.get("/me", authMiddleware, me);

export default router;
