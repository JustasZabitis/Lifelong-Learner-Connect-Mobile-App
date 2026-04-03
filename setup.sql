-- =============================================================================
-- Lifelong Learner Connect — Full Database Setup
-- =============================================================================
-- Generated from pg_dump (2026-03-25) and updated to include all schema
-- changes applied via ensureAuditTable() on the backend since that dump.
--
-- Changes vs original dump:
--   • users: added failed_login_attempts INTEGER DEFAULT 0
--   • users: added lockout_until TIMESTAMPTZ
--   • Removed pgAdmin TOC comments (OID refs) for readability
--   • Sequence SET values preserved from original dump
-- =============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';
SET default_table_access_method = heap;


-- =============================================================================
-- TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users
-- Core account table. role defaults to 'working' (legacy) but valid values
-- in practice are: student, educator, admin.
-- failed_login_attempts / lockout_until drive the escalating account lockout.
-- -----------------------------------------------------------------------------
CREATE TABLE public.users (
    id                      SERIAL PRIMARY KEY,
    email                   VARCHAR(255) NOT NULL UNIQUE,
    password                TEXT NOT NULL,
    role                    VARCHAR(50)  NOT NULL DEFAULT 'working',
    programme               TEXT,
    created_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    last_login              TIMESTAMP WITH TIME ZONE,
    force_logout_at         TIMESTAMP WITH TIME ZONE,
    suspended               BOOLEAN DEFAULT false,
    failed_login_attempts   INTEGER DEFAULT 0,
    lockout_until           TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.users OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- admin_audit_logs
-- Every admin action is recorded here (create, delete, suspend, role change…).
-- admin_id / target_user_id are nullable so rows survive user deletion.
-- -----------------------------------------------------------------------------
CREATE TABLE public.admin_audit_logs (
    id              SERIAL PRIMARY KEY,
    admin_id        INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    target_user_id  INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    details         TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.admin_audit_logs OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- announcements
-- Targeted announcements (by student_group or programme_name).
-- priority: low | medium | high
-- role_target: all | student | educator | admin
-- -----------------------------------------------------------------------------
CREATE TABLE public.announcements (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL,
    priority        VARCHAR(20)  DEFAULT 'medium',
    role_target     VARCHAR(50)  DEFAULT 'all',
    student_group   VARCHAR(100),
    programme_name  VARCHAR(255),
    created_by      INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.announcements OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- announcement_reads
-- Tracks which user has read which announcement (for read-receipt counters).
-- -----------------------------------------------------------------------------
CREATE TABLE public.announcement_reads (
    id              SERIAL PRIMARY KEY,
    announcement_id INTEGER REFERENCES public.announcements(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    read_at         TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.announcement_reads OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- conversations
-- Supports DMs (is_group=false), group chats, and broadcasts (is_broadcast=true).
-- -----------------------------------------------------------------------------
CREATE TABLE public.conversations (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255),
    is_group        BOOLEAN DEFAULT false,
    is_broadcast    BOOLEAN DEFAULT false,
    created_by      INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.conversations OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- conversation_participants
-- Junction table linking users to conversations.
-- archived_at allows a participant to leave/archive without deleting history.
-- -----------------------------------------------------------------------------
CREATE TABLE public.conversation_participants (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
    archived_at     TIMESTAMP WITHOUT TIME ZONE
);

ALTER TABLE public.conversation_participants OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- messages
-- Individual messages within a conversation.
-- -----------------------------------------------------------------------------
CREATE TABLE public.messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id       INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    content         TEXT NOT NULL,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.messages OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- events
-- Calendar events visible to specific role/student group targets.
-- type: event | deadline | holiday | other
-- -----------------------------------------------------------------------------
CREATE TABLE public.events (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    event_date      DATE NOT NULL,
    event_time      TIME WITHOUT TIME ZONE,
    type            VARCHAR(50)  DEFAULT 'event',
    role_target     VARCHAR(50)  DEFAULT 'all',
    student_group   VARCHAR(100),
    programme_name  VARCHAR(255),
    created_by      INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.events OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- personal_reminders
-- User-created private reminders shown on their calendar.
-- -----------------------------------------------------------------------------
CREATE TABLE public.personal_reminders (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    reminder_date   DATE NOT NULL,
    reminder_time   TIME WITHOUT TIME ZONE,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.personal_reminders OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- resources
-- Uploaded files (PDFs, docs, etc.) filterable by category and student group.
-- file_path stores the path/URL returned by the storage backend.
-- -----------------------------------------------------------------------------
CREATE TABLE public.resources (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    file_type       VARCHAR(100) NOT NULL,
    file_size       INTEGER,
    category        VARCHAR(50)  DEFAULT 'general',
    role_target     VARCHAR(50)  DEFAULT 'all',
    student_group   VARCHAR(100),
    programme_name  VARCHAR(255),
    created_by      INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.resources OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- forum_posts
-- Discussion board posts. tags is a Postgres text array.
-- -----------------------------------------------------------------------------
CREATE TABLE public.forum_posts (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    content     TEXT NOT NULL,
    tags        TEXT[] DEFAULT '{}',
    created_by  INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.forum_posts OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- forum_replies
-- Threaded replies to a forum post.
-- -----------------------------------------------------------------------------
CREATE TABLE public.forum_replies (
    id          SERIAL PRIMARY KEY,
    post_id     INTEGER REFERENCES public.forum_posts(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_by  INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.forum_replies OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- forum_upvotes
-- One row per user per post; unique constraint prevents duplicate upvotes.
-- -----------------------------------------------------------------------------
CREATE TABLE public.forum_upvotes (
    id       SERIAL PRIMARY KEY,
    post_id  INTEGER REFERENCES public.forum_posts(id) ON DELETE CASCADE,
    user_id  INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    UNIQUE (post_id, user_id)
);

ALTER TABLE public.forum_upvotes OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- competitions
-- Quiz / crossword / wordsearch competitions.
-- type: quiz | crossword | wordsearch
-- status: draft | active | ended
-- -----------------------------------------------------------------------------
CREATE TABLE public.competitions (
    id                  SERIAL PRIMARY KEY,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    type                VARCHAR(50)  DEFAULT 'quiz',
    status              VARCHAR(20)  DEFAULT 'draft',
    student_group       VARCHAR(100),
    programme_name      VARCHAR(255),
    time_limit          INTEGER DEFAULT 30,
    prize_description   TEXT,
    points_per_question INTEGER DEFAULT 10,
    speed_bonus         BOOLEAN DEFAULT true,
    starts_at           TIMESTAMP WITHOUT TIME ZONE,
    ends_at             TIMESTAMP WITHOUT TIME ZONE,
    created_by          INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.competitions OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- competition_questions
-- Multiple-choice questions belonging to a quiz competition.
-- correct_option is one of: A, B, C, D
-- -----------------------------------------------------------------------------
CREATE TABLE public.competition_questions (
    id              SERIAL PRIMARY KEY,
    competition_id  INTEGER REFERENCES public.competitions(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    option_a        VARCHAR(500) NOT NULL,
    option_b        VARCHAR(500) NOT NULL,
    option_c        VARCHAR(500),
    option_d        VARCHAR(500),
    correct_option  CHAR(1) NOT NULL,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.competition_questions OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- competition_attempts
-- One row per user per competition attempt (score, timing, etc.).
-- -----------------------------------------------------------------------------
CREATE TABLE public.competition_attempts (
    id              SERIAL PRIMARY KEY,
    competition_id  INTEGER REFERENCES public.competitions(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
    score           INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    time_taken      INTEGER DEFAULT 0,
    completed_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.competition_attempts OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- competition_answers
-- Individual answer choices recorded for each attempt.
-- -----------------------------------------------------------------------------
CREATE TABLE public.competition_answers (
    id          SERIAL PRIMARY KEY,
    attempt_id  INTEGER REFERENCES public.competition_attempts(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES public.competition_questions(id) ON DELETE CASCADE,
    selected_option CHAR(1),
    is_correct      BOOLEAN DEFAULT false,
    time_taken      INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.competition_answers OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- competition_words
-- Words used in crossword / wordsearch competitions.
-- -----------------------------------------------------------------------------
CREATE TABLE public.competition_words (
    id              SERIAL PRIMARY KEY,
    competition_id  INTEGER REFERENCES public.competitions(id) ON DELETE CASCADE,
    word            VARCHAR(100) NOT NULL,
    clue            TEXT,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.competition_words OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- programmes
-- Catalogue of all academic programmes, grouped by student_group.
-- nqai_level: Irish National Framework of Qualifications level (6-9).
-- programme_year: year of study (1-5).
-- -----------------------------------------------------------------------------
CREATE TABLE public.programmes (
    id              SERIAL PRIMARY KEY,
    programme_code  VARCHAR(100),
    programme_name  VARCHAR(255),
    programme_year  INTEGER,
    nqai_level      INTEGER,
    student_group   VARCHAR(100),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.programmes OWNER TO postgres;


-- -----------------------------------------------------------------------------
-- feature_flags
-- Runtime toggles for app features (announcements, messages, forum, etc.).
-- Managed from the admin portal.
-- -----------------------------------------------------------------------------
CREATE TABLE public.feature_flags (
    id          SERIAL PRIMARY KEY,
    flag_key    VARCHAR(100) NOT NULL UNIQUE,
    enabled     BOOLEAN DEFAULT true,
    label       VARCHAR(255),
    updated_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

ALTER TABLE public.feature_flags OWNER TO postgres;


-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Feature flags — initial state (all toggleable from admin portal)
INSERT INTO public.feature_flags (flag_key, enabled, label, updated_at) VALUES
    ('announcements', true,  'Announcements', '2026-03-19 19:07:58.225584'),
    ('messages',      true,  'Messages',      '2026-03-19 19:07:58.225584'),
    ('resources',     true,  'Resources',     '2026-03-19 19:07:58.225584'),
    ('calendar',      false, 'Calendar',      '2026-03-19 19:07:58.225584'),
    ('forum',         false, 'Forum',         '2026-03-19 19:07:58.225584'),
    ('progress',      false, 'Progress',      '2026-03-19 19:07:58.225584'),
    ('competitions',  true,  'Competitions',  '2026-03-19 19:07:58.225584'),
    ('group_chat',    false, 'Group Chat',    '2026-03-19 19:07:58.225584');


-- Programmes — full catalogue as of 2026-03-19
INSERT INTO public.programmes (programme_code, programme_name, programme_year, nqai_level, student_group) VALUES
-- Ireland-Midlands (Level 9 / Postgrad)
('ALBBADM9CEBAD9',   'Master of Business Administration',                                                        2, 9, 'Ireland-Midlands'),
('ALBFNMM9FNMM',     'Master of Arts in Financial Management',                                                   2, 9, 'Ireland-Midlands'),
('ALBFNMM9JNFMM9',   'Master of Arts in Financial Management',                                                   2, 9, 'Ireland-Midlands'),
('ALBFINM9FNM9',     'Postgraduate Diploma in Arts in Financial Management',                                     1, 9, 'Ireland-Midlands'),
('ALBFINM9JNFMJ9',   'Postgraduate Diploma in Arts in Financial Management',                                     2, 9, 'Ireland-Midlands'),
('ALEQMVM9JNQMM9',   'Master of Science in Quality Management and Validation',                                   2, 9, 'Ireland-Midlands'),
('ALEQMVM9QMVM',     'Master of Science in Quality Management and Validation',                                   2, 9, 'Ireland-Midlands'),
('ALEQMVD9JNQMJ9',   'Postgraduate Diploma in Quality Management and Validation',                                2, 9, 'Ireland-Midlands'),
('AL_BTALE_R09',     'Masters of Arts in Talent Management (New)',                                               1, 9, 'Ireland-Midlands'),
('AL_BTALE_R09',     'Masters of Arts in Talent Management (New)',                                               2, 9, 'Ireland-Midlands'),
('AL_BTALE_009',     'Postgraduate Diploma in Arts in Talent Management',                                        1, 9, 'Ireland-Midlands'),
('New',              'Certificate in Therapeutic and Creative Play Skills (L9, 10 ECTS)',                        1, 9, 'Ireland-Midlands'),
('New',              'Certificate in Applied Management Practice and Leadership in Education',                    1, 9, 'Ireland-Midlands'),
('New',              'Certificate in Strategic Talent Leadership and Organisational Psychology',                  1, 9, 'Ireland-Midlands'),
('New',              'Certificate in Strategic Risk, Governance and Financial Decision Making',                   1, 9, 'Ireland-Midlands'),
('New',              'Certificate in Advanced Quality Systems and Process Excellence',                            1, 9, 'Ireland-Midlands'),
('AL_BEDUD_M09',     'MA in Educational Innovation, Management and Leadership (New)',                            1, 9, 'Ireland-Midlands'),
('AL_BEDUD_M09',     'MA in Educational Innovation, Management and Leadership (New)',                            2, 9, 'Ireland-Midlands'),
-- Ireland-Midlands (Undergrad)
('ALBSTDA8CEBST8',   'Bachelor of Business (Honours) in Business',                                              4, 8, 'Ireland-Midlands'),
('ALBSTD77CEBS77',   'Bachelor of Business in Business',                                                         3, 7, 'Ireland-Midlands'),
('ALBSTDA6CEBSA6',   'Higher Certificate in Business in Business',                                              2, 6, 'Ireland-Midlands'),
('ALBSTDA6CEBSA6',   'Higher Certificate in Business in Business',                                              1, 6, 'Ireland-Midlands'),
('ALSQLMA8QLM8',     'Bachelor of Science (Honours) in Quality and Lean Management',                            4, 8, 'Ireland-Midlands'),
('ALSQLMA7QLM7',     'Apprenticeship Bachelor of Science in Quality and Lean Management',                       3, 7, 'Ireland-Midlands'),
('ALSQUAL6QUA6',     'Higher Certificate in Science in Operations Quality and Lean Management',                  2, 6, 'Ireland-Midlands'),
('AL_BPLSC_8',       'Bachelor of Business in Sustainable Procurement, Logistics and Supply Chain Management (Hons)', 4, 8, 'Ireland-Midlands'),
('AL_BPLSC_7',       'Bachelor of Business in Sustainable Procurement, Logistics and Supply Chain Management',  3, 7, 'Ireland-Midlands'),
('ALBPLSC6PLS6',     'Higher Certificate in Business in Procurement, Logistics and Supply Chain Management',    2, 6, 'Ireland-Midlands'),
('AL_HLAW_BCE',      'Bachelor of Arts in Law (New)',                                                            4, 8, 'Ireland-Midlands'),
('AL_HLAW_BCE',      'Bachelor of Arts in Law (New)',                                                            3, 8, 'Ireland-Midlands'),
('AL_HLAW_BCE',      'Bachelor of Arts in Law (New)',                                                            2, 8, 'Ireland-Midlands'),
('AL_HLAW_BCE',      'Bachelor of Arts in Law (New)',                                                            1, 8, 'Ireland-Midlands'),
('AL_BTLNT_8',       'Bachelor of Business (Honours) in Strategic Talent Management and Employee Engagement',   4, 8, 'Ireland-Midlands'),
('AL_BTLNT_7',       'Bachelor of Business in Talent Management and Organisational Change',                     3, 7, 'Ireland-Midlands'),
('AL_BTLNT_6',       'Higher Certificate in Talent Management',                                                  2, 6, 'Ireland-Midlands'),
('AL_BOPMT_8',       'Higher Diploma in Business Operations Management',                                         1, 8, 'Ireland-Midlands'),
-- Ireland-Midlands (Short Certificates)
('AL_BREAL_6',       'Certificate in Real Estate Administration',                                                1, 6, 'Ireland-Midlands'),
('AL_BPPWW_6',       'Certificate in Personal, Professional, Workplace Development and Well-being',              1, 6, 'Ireland-Midlands'),
('AL_BPRJM_7',       'Certificate in Introduction to Project Management',                                        1, 7, 'Ireland-Midlands'),
('AL_BCSRV_6',       'Certificate in Customer Service Excellence',                                               1, 6, 'Ireland-Midlands'),
('AL_BOPEX_6',       'Certificate in Operational Excellence',                                                    1, 6, 'Ireland-Midlands'),
('AL_BFNQA_6',       'Certificate in Fundamentals of Quality Assurance',                                         1, 6, 'Ireland-Midlands'),
('AL_SOPSY_6',       'Certificate in Fundamentals of Organisational Psychology',                                  1, 6, 'Ireland-Midlands'),
('AL_BPAYM_6',       'Certificate in Payroll Applications and Management',                                        1, 6, 'Ireland-Midlands'),
('AL_BSMSK_6',       'Certificate in Supervisory Management Skills for Team Leaders',                            1, 6, 'Ireland-Midlands'),
('AL_BMSTP_6',       'Certificate in Marketing, Sales, Theory and Practice',                                     1, 6, 'Ireland-Midlands'),
('AL_BIGMP_6',       'Certificate in Introduction to Good Manufacturing Practice',                               1, 6, 'Ireland-Midlands'),
('AL_BEMPD_6',       'Certificate in Employee Development',                                                      1, 6, 'Ireland-Midlands'),
('AL_BCLAW_6',       'Certificate in Contract Law, Customs and the Regulatory Environment',                      1, 6, 'Ireland-Midlands'),
('New',              'Certificate in Fundamentals of CyberSecuriity',                                            1, 6, 'Ireland-Midlands'),
('New',              'Certificate in Foundations of Nutrition for Health and Fitness (L7, 10 ECTS)',             1, 6, 'Ireland-Midlands'),
('New',              'Certificate in AI and Emerging Technologies',                                               1, 7, 'Ireland-Midlands'),
('New',              'Certificate in Applied Entrepreneurship and the Irish Enterprise Ecosystem',                1, 6, 'Ireland-Midlands'),
('New',              'Certificate in Irish Language Proficiency (Conversation/Listening)',                        1, 6, 'Ireland-Midlands'),
('New',              'Certificate in Irish Language Proficiency (Written/Reading)',                               1, 6, 'Ireland-Midlands'),
('New',              'Certificate in Volunteering',                                                               1, 6, 'Ireland-Midlands'),
('New',              'Certificate in Business English Language Acquisition for Professionals',                    1, 6, 'Ireland-Midlands'),
-- Ireland-SUSI
('AL_BSTDA_8FS',     'SUSI Bachelor of Business Level 8 (individual Entry)',                                     4, 8, 'Ireland-SUSI'),
('AL_BSTD7_7FS',     'SUSI Bachelor of Business Level 7 (individual Entry)',                                     3, 7, 'Ireland-SUSI'),
('AL_BSTDA_6FS',     'SUSI Higher Certificate in Business Year 2 (individual Entry)',                            2, 6, 'Ireland-SUSI'),
('AL_BSTDA_6FS',     'SUSI Higher Certificate in Business Year 1 (individual Entry)',                            1, 6, 'Ireland-SUSI'),
('AL_SQLMA_8FS',     'SUSI Bachelor of Science in Quality and Lean Management Level 8 (individual Entry)',       4, 8, 'Ireland-SUSI'),
('AL_SQLMA_7FS',     'SUSI Bachelor of Science in Quality and Lean Management Level 7 (individual Entry)',       3, 7, 'Ireland-SUSI'),
('AL_SQUAL_6FS',     'SUSI Higher Certificate in Operations, Quality and Lean Management Year 2 (individual Entry)', 2, 6, 'Ireland-SUSI'),
('AL_SQUAL_6FS',     'SUSI Higher Certificate in Operations, Quality and Lean Management Year 1 (individual Entry)', 1, 6, 'Ireland-SUSI'),
('AL_HLAW_8FS',      'SUSI Bachelor of Arts in Law (Hons)',                                                      5, 8, 'Ireland-SUSI'),
('AL_HLAW_8FS',      'SUSI Bachelor of Arts in Law (Hons)',                                                      4, 8, 'Ireland-SUSI'),
('AL_HLAW_8FS',      'SUSI Bachelor of Arts in Law (Hons)',                                                      3, 8, 'Ireland-SUSI'),
('AL_HLAW_8FS',      'SUSI Bachelor of Arts in Law (Hons)',                                                      2, 8, 'Ireland-SUSI'),
('AL_HLAW_8FS',      'SUSI Bachelor of Arts in Law (Hons)',                                                      1, 8, 'Ireland-SUSI'),
-- Middle East
('AL_BTALE_R09',     'Masters of Arts in Talent Management',                                                     2, 9, 'Middle East'),
('AL_BTALE_R09',     'Masters of Arts in Talent Management',                                                     1, 9, 'Middle East'),
('AL_BEDUD_M09',     'MA in Educational Innovation, Management and Leadership (New)',                            1, 9, 'Middle East'),
('AL_BEDUD_M09',     'MA in Educational Innovation, Management and Leadership (New)',                            2, 9, 'Middle East'),
('New',              'Certificate in Therapeutic and Creative Play Skills (L9, 10 ECTS)',                        1, 9, 'Middle East'),
('New',              'Certificate in Applied Management Practice and Leadership in Education',                    1, 9, 'Middle East'),
('New',              'Certificate in AI and Emerging Technologies',                                               1, 6, 'Middle East'),
('New',              'Certificate in Irish Language Proficiency (Conversation/Listening)',                        1, 6, 'Middle East'),
('New',              'Certificate in Irish Language Proficiency (Written/Reading)',                               1, 6, 'Middle East'),
('New',              'Certificate in Foundations of Nutrition for Health and Fitness (L7, 10 ECTS)',             1, 6, 'Middle East'),
('AL_BPPWW_6',       'Certificate in Personal, Professional, Workplace Development and Well-being',              1, 6, 'Middle East'),
-- SB+
('ALBEXEC9EXE9',     'Postgraduate Diploma in Business in Executive Management',                                  1, 9, 'SB+'),
('ALEQMVD9QMV9',     'Postgraduate Diploma in Quality Management and Validation',                                1, 9, 'SB+'),
(NULL,               'MSc Software Cloud NativeC PT',                                                            1, 9, 'SB+'),
(NULL,               'PgD in Eng in Eng Management',                                                             1, 9, 'SB+'),
('ALBFPAY6FPA6',     'Certificate in Financial Accounting and Payroll',                                          1, 6, 'SB+'),
('ALBHRMT6HRMT',     'Special Purpose Award - Certificate in Human Resource Management',                         1, 6, 'SB+'),
('ALBLSCM6LSC6',     'Certificate in Logistics and Supply Chain Management',                                     1, 6, 'SB+'),
('ALBSMTL6SMT6',     'Certificate in Supervisory Management and Team Leadership',                                 1, 6, 'SB+'),
('ALSOQLM6OQL6',     'Certificate in Operations Quality and Lean Management',                                    1, 6, 'SB+'),
(NULL,               'Certificate in Culinary Skills',                                                           1, 6, 'SB+'),
(NULL,               'HC in Culinary Arts PT',                                                                    1, 6, 'SB+'),
(NULL,               'HD in Bus in Leadership',                                                                   1, 8, 'SB+');


-- =============================================================================
-- SEQUENCE RESETS
-- Bump sequences to match the highest IDs from the original dump so that
-- new inserts don't collide with existing data if you restore the seed data.
-- =============================================================================
SELECT pg_catalog.setval('public.users_id_seq',                   5,  true);
SELECT pg_catalog.setval('public.admin_audit_logs_id_seq',        8,  true);
SELECT pg_catalog.setval('public.announcements_id_seq',           9,  true);
SELECT pg_catalog.setval('public.announcement_reads_id_seq',      14, true);
SELECT pg_catalog.setval('public.conversations_id_seq',           3,  true);
SELECT pg_catalog.setval('public.conversation_participants_id_seq',6, true);
SELECT pg_catalog.setval('public.messages_id_seq',                3,  true);
SELECT pg_catalog.setval('public.events_id_seq',                  1,  false);
SELECT pg_catalog.setval('public.personal_reminders_id_seq',      1,  false);
SELECT pg_catalog.setval('public.resources_id_seq',               1,  false);
SELECT pg_catalog.setval('public.forum_posts_id_seq',             1,  false);
SELECT pg_catalog.setval('public.forum_replies_id_seq',           1,  false);
SELECT pg_catalog.setval('public.forum_upvotes_id_seq',           1,  false);
SELECT pg_catalog.setval('public.competitions_id_seq',            5,  true);
SELECT pg_catalog.setval('public.competition_questions_id_seq',   6,  true);
SELECT pg_catalog.setval('public.competition_attempts_id_seq',    8,  true);
SELECT pg_catalog.setval('public.competition_answers_id_seq',     12, true);
SELECT pg_catalog.setval('public.competition_words_id_seq',       8,  true);
SELECT pg_catalog.setval('public.programmes_id_seq',              93, true);
SELECT pg_catalog.setval('public.feature_flags_id_seq',           8,  true);