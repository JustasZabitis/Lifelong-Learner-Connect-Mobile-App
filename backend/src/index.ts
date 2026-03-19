import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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
import featureFlagRoutes from "./routes/featureFlag.routes";
import { pool } from "./config/db";

dotenv.config();

const app = express();

// ─── Create HTTP server (needed so Socket.io can share the same port) ───
const httpServer = createServer(app);

// ─── Socket.io setup ────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: "*", // In production, restrict this to your app's domain
    methods: ["GET", "POST"],
  },
});

// ─── Middleware ──────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── REST Routes ─────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "Backend is working" });
});

app.use("/api/auth", authRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/competitions", competitionRoutes);
app.use("/api/features", featureFlagRoutes);

// ─── Socket.io: Authentication ───────────────────────────────────────────
// Every socket connection must send a valid JWT token.
// We verify it here before allowing them into any chat rooms.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication error: No token"));
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "secret_key_ABCD_8673217853219853965321"
    ) as { id: number; email: string; role: string };

    // Attach user info to the socket so we can use it in event handlers
    (socket as any).user = decoded;
    next();
  } catch (err) {
    next(new Error("Authentication error: Invalid token"));
  }
});

// ─── Socket.io: Events ───────────────────────────────────────────────────
io.on("connection", (socket) => {
  const user = (socket as any).user;
  console.log(`User connected: ${user.email} (id: ${user.id})`);

  /* ── JOIN ROOM ──────────────────────────────────────────────────────
     The client calls this when they open a conversation.
     They join a "room" named after the conversation ID.
     Socket.io will then only send messages to people in that room.
  ──────────────────────────────────────────────────────────────────── */
  socket.on("join_conversation", (conversationId: number) => {
    socket.join(`conversation_${conversationId}`);
    console.log(`${user.email} joined conversation_${conversationId}`);
  });

  /* ── LEAVE ROOM ─────────────────────────────────────────────────────
     Called when the user navigates away from a chat screen.
  ──────────────────────────────────────────────────────────────────── */
  socket.on("leave_conversation", (conversationId: number) => {
    socket.leave(`conversation_${conversationId}`);
    console.log(`${user.email} left conversation_${conversationId}`);
  });

  /* ── SEND MESSAGE ───────────────────────────────────────────────────
     1. Save the message to PostgreSQL (so it persists)
     2. Broadcast it to everyone in the room in real time
  ──────────────────────────────────────────────────────────────────── */
  socket.on(
    "send_message",
    async (data: { conversation_id: number; content: string }) => {
      const { conversation_id, content } = data;

      if (!content || !conversation_id) return;

      try {
        // Verify the sender is actually a participant of this conversation
        const membership = await pool.query(
          `SELECT 1 FROM conversation_participants
           WHERE conversation_id = $1 AND user_id = $2`,
          [conversation_id, user.id]
        );

        if (membership.rows.length === 0) {
          socket.emit("error", { message: "Not a participant of this conversation" });
          return;
        }

        // Save to DB
        const result = await pool.query(
          `INSERT INTO messages (conversation_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, conversation_id, sender_id, content, created_at`,
          [conversation_id, user.id, content]
        );

        const savedMessage = result.rows[0];

        // Broadcast to everyone in the room (including the sender)
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

  /* ── TYPING INDICATOR ───────────────────────────────────────────────
     Broadcasts to other users in the room that someone is typing.
     The frontend can show "User is typing..." with this.
  ──────────────────────────────────────────────────────────────────── */
  socket.on("typing", (conversationId: number) => {
    socket.to(`conversation_${conversationId}`).emit("user_typing", {
      user_id: user.id,
      email: user.email,
    });
  });

  socket.on("stop_typing", (conversationId: number) => {
    socket.to(`conversation_${conversationId}`).emit("user_stop_typing", {
      user_id: user.id,
    });
  });

  /* ── DISCONNECT ─────────────────────────────────────────────────────
     Socket.io handles cleanup automatically, but we log it here.
  ──────────────────────────────────────────────────────────────────── */
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${user.email}`);
  });
});

// ─── Start Server ────────────────────────────────────────────────────────
// IMPORTANT: Use httpServer.listen (not app.listen) so Socket.io works
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io ready`);
});