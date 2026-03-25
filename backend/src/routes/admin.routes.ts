/**
 * Admin management routes for user CRUD, role changes, and audit logging.
 * All routes require authentication; individual admin checks are enforced in controllers.
 */

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  getUsers,
  getUserProfile,
  createUser,
  deleteUser,
  toggleSuspend,
  changeRole,
  resetPassword,
  forceLogout,
  bulkDeleteUsers,
  getAuditLogs,
  getStats,
  getInactiveUsers,
} from "../controllers/admin.controller";

const router = Router();

// GET /api/admin/users — list all users with optional filters (search, role, status)
router.get("/users", authMiddleware, getUsers);

// GET /api/admin/users/inactive — list inactive users (configurable day threshold)
router.get("/users/inactive", authMiddleware, getInactiveUsers);

// GET /api/admin/users/:id — fetch a single user's profile
router.get("/users/:id", authMiddleware, getUserProfile);

// POST /api/admin/users — create a new user account
router.post("/users", authMiddleware, createUser);

// DELETE /api/admin/users/bulk-delete — delete multiple users at once
router.delete("/users/bulk-delete", authMiddleware, bulkDeleteUsers);

// DELETE /api/admin/users/:id — delete a single user
router.delete("/users/:id", authMiddleware, deleteUser);

// PATCH /api/admin/users/:id/suspend — toggle user suspension status
router.patch("/users/:id/suspend", authMiddleware, toggleSuspend);

// PATCH /api/admin/users/:id/role — change user's role
router.patch("/users/:id/role", authMiddleware, changeRole);

// PATCH /api/admin/users/:id/reset-password — admin password reset
router.patch("/users/:id/reset-password", authMiddleware, resetPassword);

// PATCH /api/admin/users/:id/force-logout — invalidate all user sessions
router.patch("/users/:id/force-logout", authMiddleware, forceLogout);

// GET /api/admin/audit-logs — fetch audit trail of admin actions
router.get("/audit-logs", authMiddleware, getAuditLogs);

// GET /api/admin/stats — fetch comprehensive user statistics
router.get("/stats", authMiddleware, getStats);

export default router;
