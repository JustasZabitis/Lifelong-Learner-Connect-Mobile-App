/**
 * Authentication middleware for protecting routes.
 * Verifies JWT tokens from Authorization header (mobile) or httpOnly cookies (web).
 * Also checks for force-logout and account suspension status.
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/db";

export interface AuthRequest extends Request {
  user?: any;
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Try to get token from Authorization header first (format: "Bearer <token>"),
  // fall back to httpOnly cookie if header is missing
  const authHeader = req.headers.authorization;
  const token = authHeader
    ? authHeader.split(" ")[1]
    : (req as any).cookies?.token;

  // Reject request if no token found
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    // Decode and verify the JWT signature using the secret key
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as any;

    // Check if user still exists and fetch their suspension/logout status
    const result = await pool.query(
      "SELECT force_logout_at, suspended FROM users WHERE id = $1",
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    const { force_logout_at, suspended } = result.rows[0];

    // If the user's account has been suspended, deny access immediately
    if (suspended) {
      return res.status(403).json({ error: "Account suspended" });
    }

    // Check if this token was issued before an admin force-logout.
    // If force_logout_at is newer than when the token was issued (iat),
    // the token is considered revoked and should be rejected.
    if (force_logout_at) {
      const revokedAt = new Date(force_logout_at).getTime() / 1000; // convert to seconds
      if (decoded.iat && decoded.iat < revokedAt) {
        return res.status(401).json({ error: "Session invalidated" });
      }
    }

    // Attach decoded user info to request object so downstream handlers can access it
    req.user = decoded;
    next();
  } catch (err) {
    // JWT verification failed (invalid signature, expired, malformed, etc.)
    return res.status(403).json({ error: "Invalid token" });
  }
};