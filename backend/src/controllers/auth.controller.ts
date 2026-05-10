/**
 * Authentication controllers for register, login, logout, and session check.
 * Handles both web (httpOnly cookies) and mobile (SecureStore) token persistence.
 */

import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { AuthRequest } from "../middleware/auth.middleware";

const IS_PROD = process.env.NODE_ENV === "production";

// Configuration for httpOnly cookies. httpOnly prevents JavaScript from reading the token,
// secure enforces HTTPS in production, sameSite prevents CSRF attacks, maxAge matches JWT expiry time
const COOKIE_OPTS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 1000, // 1 hour (matches JWT expiry in auth.service)
  path: "/",
};

// Handles user registration by calling the auth service to create a new user account
export const register = async (req: Request, res: Response) => {
  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// Handles user login by validating credentials and issuing a JWT token
export const login = async (req: Request, res: Response) => {
  try {
    const token = await authService.loginUser(req.body);

    // Set httpOnly cookie for web browsers (sent automatically with each request).
    // Also return token in response body for mobile apps to store in SecureStore.
    res.cookie("token", token, COOKIE_OPTS);
    res.json({ token });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

// Handles logout by clearing the httpOnly cookie on the browser
export const logout = async (_req: Request, res: Response) => {
  res.clearCookie("token", { path: "/" });
  res.json({ message: "Logged out" });
};

// Returns the current authenticated user's info (id, email, role).
// Frontend calls this periodically to detect force-logout or account suspension.
// The authMiddleware already checks for these conditions, so a 401 here means the token was revoked.
export const me = async (req: AuthRequest, res: Response) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
};
