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
-- Educator and admin created announcements with priority,
-- role targeting, and student group targeting
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(255) NOT NULL,
  content         TEXT NOT NULL,
  priority        VARCHAR(20) DEFAULT 'medium',
  role_target     VARCHAR(50) DEFAULT 'all',
  student_group   VARCHAR(100),
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_student_group
  ON announcements(student_group);


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
-- DISCUSSION FORUMS
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


-- ============================================================
-- TUS PROGRAMMES
-- 2026/2027 Programme List — Lifelong Learner Connect
-- student_group used for targeted messaging and announcements
-- Groups: Ireland-Midlands, Ireland-SUSI, SB+, Middle East, India, China
-- ============================================================

CREATE TABLE IF NOT EXISTS programmes (
  id              SERIAL PRIMARY KEY,
  programme_code  VARCHAR(100),
  programme_name  VARCHAR(255),
  programme_year  INTEGER,
  nqai_level      INTEGER,
  student_group   VARCHAR(100),
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programmes_code ON programmes(programme_code);
CREATE INDEX IF NOT EXISTS idx_programmes_group ON programmes(student_group);

INSERT INTO programmes (programme_code, programme_name, programme_year, nqai_level, student_group) VALUES
('ALBBADM9CEBAD9','Master of Business Administration',2,9,'Ireland-Midlands'),
('ALBFNMM9FNMM','Master of Arts in Financial Management',2,9,'Ireland-Midlands'),
('ALBFNMM9JNFMM9','Master of Arts in Financial Management',2,9,'Ireland-Midlands'),
('ALBFINM9FNM9','Postgraduate Diploma in Arts in Financial Management',1,9,'Ireland-Midlands'),
('ALBFINM9JNFMJ9','Postgraduate Diploma in Arts in Financial Management',2,9,'Ireland-Midlands'),
('ALEQMVM9JNQMM9','Master of Science in Quality Management and Validation',2,9,'Ireland-Midlands'),
('ALEQMVM9QMVM','Master of Science in Quality Management and Validation',2,9,'Ireland-Midlands'),
('ALEQMVD9JNQMJ9','Postgraduate Diploma in Quality Management and Validation',2,9,'Ireland-Midlands'),
('AL_BTALE_R09','Masters of Arts in Talent Management (New)',1,9,'Ireland-Midlands'),
('AL_BTALE_R09','Masters of Arts in Talent Management (New)',2,9,'Ireland-Midlands'),
('AL_BTALE_009','Postgraduate Diploma in Arts in Talent Management',1,9,'Ireland-Midlands'),
('New','Certificate in Therapeutic and Creative Play Skills (L9, 10 ECTS)',1,9,'Ireland-Midlands'),
('New','Certificate in Applied Management Practice and Leadership in Education',1,9,'Ireland-Midlands'),
('New','Certificate in Strategic Talent Leadership and Organisational Psychology',1,9,'Ireland-Midlands'),
('New','Certificate in Strategic Risk, Governance and Financial Decision Making',1,9,'Ireland-Midlands'),
('New','Certificate in Advanced Quality Systems and Process Excellence',1,9,'Ireland-Midlands'),
('AL_BTALE_R09','Masters of Arts in Talent Management',2,9,'Middle East'),
('AL_BTALE_R09','Masters of Arts in Talent Management',1,9,'Middle East'),
('AL_BEDUD_M09','MA in Educational Innovation, Management and Leadership (New)',1,9,'Middle East'),
('AL_BEDUD_M09','MA in Educational Innovation, Management and Leadership (New)',2,9,'Middle East'),
('New','Certificate in Therapeutic and Creative Play Skills (L9, 10 ECTS)',1,9,'Middle East'),
('New','Certificate in Applied Management Practice and Leadership in Education',1,9,'Middle East'),
('AL_BEDUD_M09','MA in Educational Innovation, Management and Leadership (New)',1,9,'Ireland-Midlands'),
('AL_BEDUD_M09','MA in Educational Innovation, Management and Leadership (New)',2,9,'Ireland-Midlands'),
('ALBSTDA8CEBST8','Bachelor of Business (Honours) in Business',4,8,'Ireland-Midlands'),
('ALBSTD77CEBS77','Bachelor of Business in Business',3,7,'Ireland-Midlands'),
('ALBSTDA6CEBSA6','Higher Certificate in Business in Business',2,6,'Ireland-Midlands'),
('ALBSTDA6CEBSA6','Higher Certificate in Business in Business',1,6,'Ireland-Midlands'),
('ALSQLMA8QLM8','Bachelor of Science (Honours) in Quality and Lean Management',4,8,'Ireland-Midlands'),
('ALSQLMA7QLM7','Apprenticeship Bachelor of Science in Quality and Lean Management',3,7,'Ireland-Midlands'),
('ALSQUAL6QUA6','Higher Certificate in Science in Operations Quality and Lean Management',2,6,'Ireland-Midlands'),
('AL_BPLSC_8','Bachelor of Business in Sustainable Procurement, Logistics and Supply Chain Management (Hons)',4,8,'Ireland-Midlands'),
('AL_BPLSC_7','Bachelor of Business in Sustainable Procurement, Logistics and Supply Chain Management',3,7,'Ireland-Midlands'),
('ALBPLSC6PLS6','Higher Certificate in Business in Procurement, Logistics and Supply Chain Management',2,6,'Ireland-Midlands'),
('AL_HLAW_BCE','Bachelor of Arts in Law (New)',4,8,'Ireland-Midlands'),
('AL_HLAW_BCE','Bachelor of Arts in Law (New)',3,8,'Ireland-Midlands'),
('AL_HLAW_BCE','Bachelor of Arts in Law (New)',2,8,'Ireland-Midlands'),
('AL_HLAW_BCE','Bachelor of Arts in Law (New)',1,8,'Ireland-Midlands'),
('AL_BTLNT_8','Bachelor of Business (Honours) in Strategic Talent Management and Employee Engagement',4,8,'Ireland-Midlands'),
('AL_BTLNT_7','Bachelor of Business in Talent Management and Organisational Change',3,7,'Ireland-Midlands'),
('AL_BTLNT_6','Higher Certificate in Talent Management',2,6,'Ireland-Midlands'),
('AL_BOPMT_8','Higher Diploma in Business Operations Management',1,8,'Ireland-Midlands'),
('AL_BREAL_6','Certificate in Real Estate Administration',1,6,'Ireland-Midlands'),
('AL_BPPWW_6','Certificate in Personal, Professional, Workplace Development and Well-being',1,6,'Ireland-Midlands'),
('AL_BPRJM_7','Certificate in Introduction to Project Management',1,7,'Ireland-Midlands'),
('AL_BCSRV_6','Certificate in Customer Service Excellence',1,6,'Ireland-Midlands'),
('AL_BOPEX_6','Certificate in Operational Excellence',1,6,'Ireland-Midlands'),
('AL_BFNQA_6','Certificate in Fundamentals of Quality Assurance',1,6,'Ireland-Midlands'),
('AL_SOPSY_6','Certificate in Fundamentals of Organisational Psychology',1,6,'Ireland-Midlands'),
('AL_BPAYM_6','Certificate in Payroll Applications and Management',1,6,'Ireland-Midlands'),
('AL_BSMSK_6','Certificate in Supervisory Management Skills for Team Leaders',1,6,'Ireland-Midlands'),
('AL_BMSTP_6','Certificate in Marketing, Sales, Theory and Practice',1,6,'Ireland-Midlands'),
('AL_BIGMP_6','Certificate in Introduction to Good Manufacturing Practice',1,6,'Ireland-Midlands'),
('AL_BEMPD_6','Certificate in Employee Development',1,6,'Ireland-Midlands'),
('AL_BCLAW_6','Certificate in Contract Law, Customs and the Regulatory Environment',1,6,'Ireland-Midlands'),
('New','Certificate in Fundamentals of CyberSecuriity',1,6,'Ireland-Midlands'),
('New','Certificate in Foundations of Nutrition for Health and Fitness (L7, 10 ECTS)',1,6,'Ireland-Midlands'),
('New','Certificate in AI and Emerging Technologies',1,7,'Ireland-Midlands'),
('New','Certificate in Applied Entrepreneurship and the Irish Enterprise Ecosystem',1,6,'Ireland-Midlands'),
('New','Certificate in Irish Language Proficiency (Conversation/Listening)',1,6,'Ireland-Midlands'),
('New','Certificate in Irish Language Proficiency (Written/Reading)',1,6,'Ireland-Midlands'),
('New','Certificate in Volunteering',1,6,'Ireland-Midlands'),
('New','Certificate in Business English Language Acquisition for Professionals',1,6,'Ireland-Midlands'),
('AL_BSTDA_8FS','SUSI Bachelor of Business Level 8 (individual Entry)',4,8,'Ireland-SUSI'),
('AL_BSTD7_7FS','SUSI Bachelor of Business Level 7 (individual Entry)',3,7,'Ireland-SUSI'),
('AL_BSTDA_6FS','SUSI Higher Certificate in Business Year 2 (individual Entry)',2,6,'Ireland-SUSI'),
('AL_BSTDA_6FS','SUSI Higher Certificate in Business Year 1 (individual Entry)',1,6,'Ireland-SUSI'),
('AL_SQLMA_8FS','SUSI Bachelor of Science in Quality and Lean Management Level 8 (individual Entry)',4,8,'Ireland-SUSI'),
('AL_SQLMA_7FS','SUSI Bachelor of Science in Quality and Lean Management Level 7 (individual Entry)',3,7,'Ireland-SUSI'),
('AL_SQUAL_6FS','SUSI Higher Certificate in Operations, Quality and Lean Management Year 2 (individual Entry)',2,6,'Ireland-SUSI'),
('AL_SQUAL_6FS','SUSI Higher Certificate in Operations, Quality and Lean Management Year 1 (individual Entry)',1,6,'Ireland-SUSI'),
('AL_HLAW_8FS','SUSI Bachelor of Arts in Law (Hons)',5,8,'Ireland-SUSI'),
('AL_HLAW_8FS','SUSI Bachelor of Arts in Law (Hons)',4,8,'Ireland-SUSI'),
('AL_HLAW_8FS','SUSI Bachelor of Arts in Law (Hons)',3,8,'Ireland-SUSI'),
('AL_HLAW_8FS','SUSI Bachelor of Arts in Law (Hons)',2,8,'Ireland-SUSI'),
('AL_HLAW_8FS','SUSI Bachelor of Arts in Law (Hons)',1,8,'Ireland-SUSI'),
('New','Certificate in AI and Emerging Technologies',1,6,'Middle East'),
('New','Certificate in Irish Language Proficiency (Conversation/Listening)',1,6,'Middle East'),
('New','Certificate in Irish Language Proficiency (Written/Reading)',1,6,'Middle East'),
('New','Certificate in Foundations of Nutrition for Health and Fitness (L7, 10 ECTS)',1,6,'Middle East'),
('AL_BPPWW_6','Certificate in Personal, Professional, Workplace Development and Well-being',1,6,'Middle East'),
('ALBEXEC9EXE9','Postgraduate Diploma in Business in Executive Management',1,9,'SB+'),
('ALEQMVD9QMV9','Postgraduate Diploma in Quality Management and Validation',1,9,'SB+'),
(NULL,'MSc Software Cloud NativeC PT',1,9,'SB+'),
(NULL,'PgD in Eng in Eng Management',1,9,'SB+'),
('ALBFPAY6FPA6','Certificate in Financial Accounting and Payroll',1,6,'SB+'),
('ALBHRMT6HRMT','Special Purpose Award - Certificate in Human Resource Management',1,6,'SB+'),
('ALBLSCM6LSC6','Certificate in Logistics and Supply Chain Management',1,6,'SB+'),
('ALBSMTL6SMT6','Certificate in Supervisory Management and Team Leadership',1,6,'SB+'),
('ALSOQLM6OQL6','Certificate in Operations Quality and Lean Management',1,6,'SB+'),
(NULL,'Certificate in Culinary Skills',1,6,'SB+'),
(NULL,'HC in Culinary Arts PT',1,6,'SB+'),
(NULL,'HD in Bus in Leadership',1,8,'SB+');


-- ============================================================
-- END OF SETUP
-- ============================================================
-- Tables created: 13
--   1.  users
--   2.  announcements          (now includes student_group)
--   3.  announcement_reads
--   4.  conversations
--   5.  conversation_participants
--   6.  messages
--   7.  events
--   8.  personal_reminders
--   9.  resources
--  10.  forum_posts
--  11.  forum_replies
--  12.  forum_upvotes
--  13.  programmes              (pre-populated with 2026/2027 data)
-- ============================================================