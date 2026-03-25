/**
 * Main server entry point for Lifelong Learner Connect backend.
 * Handles REST API routes, real-time messaging via Socket.io,
 * rate limiting, authentication, and error handling.
 */

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

import authRoutes from "./routes/auth.routes";
import announcementRoutes from "./routes/announcement.routes";
import messageRoutes from "./routes/message.routes";
import calendarRoutes from "./routes/calendar.routes";
import resourceRoutes from "./routes/resource.routes";
import forumRoutes from "./routes/forum.routes";
import progressRoutes from "./routes/progress.routes";
import competitionRoutes from "./routes/competition.routes";
import featureFlagRoutes from "./routes/Featureflag.routes";
import adminRoutes from "./routes/admin.routes";
import { ensureAuditTable } from "./controllers/admin.controller";
import { pool } from "./config/db";

// Load environment variables from .env file
dotenv.config();

const app = express();

// Create an HTTP server so Socket.io can attach to the same port
const httpServer = createServer(app);

// Initialize Socket.io for real-time messaging with CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, restrict to your frontend domain only
    methods: ["GET", "POST"],
  },
});

// Global middleware stack
app.use(cors({ origin: true, credentials: true })); // Enable cookies for credentials
app.use(cookieParser());
app.use(express.json());

// Rate limiter for authentication endpoints to prevent brute force attacks
// Allows max 10 requests per 15 minutes from a single IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: "Too many attempts. Please try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for general API endpoints to prevent server hammering
// Allows max 200 requests per minute from a single IP (generous limit)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ message: "Backend is working" });
});

// Mount all API routes with appropriate rate limiters
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", apiLimiter); // General API rate limiter for other routes
app.use("/api/announcements", announcementRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/competitions", competitionRoutes);
app.use("/api/features", featureFlagRoutes);
app.use("/api/admin", adminRoutes);

// Error handler for multer (file upload) errors
// Catches file size limit and file type validation errors
app.use((err: any, _req: any, res: any, next: any) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large. Maximum size is 100 MB." });
  }
  if (err?.message?.startsWith("File type not allowed")) {
    return res.status(415).json({ error: err.message });
  }
  next(err);
});

// Socket.io middleware to authenticate incoming connections with JWT tokens
// Verifies the token before allowing the user to join any rooms
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication error: No token"));
  }

  try {
    // Verify JWT signature and extract user info
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret_key_ABCD_8673217853219853965321"
    ) as { id: number; email: string; role: string };

    // Attach decoded user info to socket for use in event handlers
    (socket as any).user = decoded;
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
});

// Socket.io event handlers for real-time messaging and presence
io.on("connection", (socket) => {
  const user = (socket as any).user;
  console.log(`User connected: ${user.email} (id: ${user.id})`);

  // When user opens a conversation, they join a room named "conversation_<id>"
  // Socket.io will route messages only to users in that room
  socket.on("join_conversation", (conversationId: number) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`${user.email} joined conversation_${conversationId}`);
  });

  // When user leaves a conversation screen, they leave the room
  socket.on("leave_conversation", (conversationId: number) => {
    socket.leave(`conversation_${conversationId}`);
    console.log(`${user.email} left conversation_${conversationId}`);
  });

  // Handles incoming messages: saves to DB and broadcasts to room
  socket.on(
    "send_message",
    async (data: { conversation_id: number; content: string }) => {
      const { conversation_id, content } = data;

      // Ignore empty messages or missing conversation ID
      if (!content || !conversation_id) return;

      try {
        // Verify that the sender is actually a participant of this conversation
        // (prevents users from sending messages to private conversations they shouldn't access)
        const membership = await pool.query(
          `SELECT 1 FROM conversation_participants
           WHERE conversation_id = $1 AND user_id = $2`,
          [conversation_id, user.id]
        );

        if (membership.rows.length === 0) {
          socket.emit("error", { message: "Not a participant of this conversation" });
          return;
        }

        // Persist the message to the database
        const result = await pool.query(
          `INSERT INTO messages (conversation_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, conversation_id, sender_id, content, created_at`,
          [conversation_id, user.id, content]
        );

        const savedMessage = result.rows[0];

        // Broadcast the message to all users in the conversation room (including sender)
        io.to(`conversation_${conversation_id}`).emit("receive_message", {
          ...savedMessage,
          sender_email: user.email,
        });
      } catch (error) {
        console.error("Send message error:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    }
  );

  // Broadcasts "typing indicator" to other users in the conversation
  socket.on("typing", (conversationId: number) => {
    socket.to(`conversation_${conversationId}`).emit("user_typing", {
      user_id: user.id,
      email: user.email,
    });
  });

  // Clears the "typing indicator" when user stops typing
  socket.on("stop_typing", (conversationId: number) => {
    socket.to(`conversation_${conversationId}`).emit("user_stop_typing", {
      user_id: user.id,
    });
  });

  // Logs when a user disconnects (Socket.io handles cleanup automatically)
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${user.email}`);
  });
});

// Server startup — initialize database and listen on port
// NOTE: Must use httpServer.listen (not app.listen) for Socket.io to work correctly
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io ready`);
  // Create audit log table and add any missing columns on startup
  await ensureAuditTable();
});