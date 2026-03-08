-- ============================================================
-- Lifelong Learner Connect — Full Database Setup
-- Run this once on a fresh PostgreSQL database to create
-- everything the app needs. Make sure you have already created
-- the database called lifelong_learner_connect before running this.
-- ============================================================


-- ============================================================
-- USERS
-- Stores all user accounts across every role
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password      TEXT NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'working',
  created_at    TIMESTAMP DEFAULT NOW()
);


-- ============================================================
-- ANNOUNCEMENTS
-- Educator and admin created announcements with priority
-- and role targeting
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  content       TEXT NOT NULL,
  priority      VARCHAR(20) DEFAULT 'medium',
  role_target   VARCHAR(50) DEFAULT 'all',
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);


-- ============================================================
-- ANNOUNCEMENT READS
-- Tracks which users have read which announcements
-- Used for the read receipt / view count feature
-- ============================================================

CREATE TABLE IF NOT EXISTS announcement_reads (
  id                SERIAL PRIMARY KEY,
  announcement_id   INTEGER REFERENCES announcements(id) ON DELETE CASCADE,
  user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
  read_at           TIMESTAMP DEFAULT NOW(),
  UNIQUE (announcement_id, user_id)
);


-- ============================================================
-- CONVERSATIONS
-- Each row is either a direct message conversation or a group chat
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255),
  is_group      BOOLEAN DEFAULT FALSE,
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);


-- ============================================================
-- CONVERSATION PARTICIPANTS
-- Links users to the conversations they are part of
-- ============================================================

CREATE TABLE IF NOT EXISTS conversation_participants (
  id                SERIAL PRIMARY KEY,
  conversation_id   INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
  joined_at         TIMESTAMP DEFAULT NOW(),
  UNIQUE (conversation_id, user_id)
);


-- ============================================================
-- MESSAGES
-- Individual messages sent within a conversation
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id                SERIAL PRIMARY KEY,
  conversation_id   INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content           TEXT NOT NULL,
  created_at        TIMESTAMP DEFAULT NOW()
);


-- ============================================================
-- EVENTS
-- Course events and deadlines created by educators
-- Appear on the main calendar screen
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  event_date    DATE NOT NULL,
  event_time    TIME,
  type          VARCHAR(50) DEFAULT 'event',
  role_target   VARCHAR(50) DEFAULT 'all',
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);


-- ============================================================
-- PERSONAL REMINDERS
-- Private per-user reminders only visible to the person who created them
-- ============================================================

CREATE TABLE IF NOT EXISTS personal_reminders (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(255) NOT NULL,
  reminder_date     DATE NOT NULL,
  reminder_time     TIME,
  created_at        TIMESTAMP DEFAULT NOW()
);


-- ============================================================
-- RESOURCES
-- File metadata for everything uploaded through the Resource Hub
-- The actual files are stored in backend/uploads/
-- ============================================================

CREATE TABLE IF NOT EXISTS resources (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  file_name     VARCHAR(255) NOT NULL,
  file_path     VARCHAR(500) NOT NULL,
  file_type     VARCHAR(100) NOT NULL,
  file_size     INTEGER,
  category      VARCHAR(50) DEFAULT 'general',
  role_target   VARCHAR(50) DEFAULT 'all',
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);



-- ============================================================
-- Discussion Forums Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS forum_posts (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  content     TEXT NOT NULL,
  tags        TEXT[] DEFAULT '{}',
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_replies (
  id          SERIAL PRIMARY KEY,
  post_id     INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_upvotes (
  id       SERIAL PRIMARY KEY,
  post_id  INTEGER REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (post_id, user_id)
);
