--
-- PostgreSQL database dump
--



-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

-- Started on 2026-03-25 02:52:44

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 258 (class 1259 OID 17121)
-- Name: admin_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_audit_logs (
    id integer NOT NULL,
    admin_id integer,
    action character varying(100) NOT NULL,
    target_user_id integer,
    details text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.admin_audit_logs OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 17120)
-- Name: admin_audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_audit_logs_id_seq OWNER TO postgres;

--
-- TOC entry 5293 (class 0 OID 0)
-- Dependencies: 257
-- Name: admin_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_audit_logs_id_seq OWNED BY public.admin_audit_logs.id;


--
-- TOC entry 224 (class 1259 OID 16769)
-- Name: announcement_reads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.announcement_reads (
    id integer NOT NULL,
    announcement_id integer,
    user_id integer,
    read_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.announcement_reads OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16768)
-- Name: announcement_reads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.announcement_reads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.announcement_reads_id_seq OWNER TO postgres;

--
-- TOC entry 5294 (class 0 OID 0)
-- Dependencies: 223
-- Name: announcement_reads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.announcement_reads_id_seq OWNED BY public.announcement_reads.id;


--
-- TOC entry 222 (class 1259 OID 16749)
-- Name: announcements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.announcements (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying,
    role_target character varying(50) DEFAULT 'all'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    student_group character varying(100),
    programme_name character varying(255)
);


ALTER TABLE public.announcements OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16748)
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.announcements_id_seq OWNER TO postgres;

--
-- TOC entry 5295 (class 0 OID 0)
-- Dependencies: 221
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- TOC entry 250 (class 1259 OID 17043)
-- Name: competition_answers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.competition_answers (
    id integer NOT NULL,
    attempt_id integer,
    question_id integer,
    selected_option character(1),
    is_correct boolean DEFAULT false,
    time_taken integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.competition_answers OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 17042)
-- Name: competition_answers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.competition_answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competition_answers_id_seq OWNER TO postgres;

--
-- TOC entry 5296 (class 0 OID 0)
-- Dependencies: 249
-- Name: competition_answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.competition_answers_id_seq OWNED BY public.competition_answers.id;


--
-- TOC entry 248 (class 1259 OID 17016)
-- Name: competition_attempts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.competition_attempts (
    id integer NOT NULL,
    competition_id integer,
    user_id integer,
    score integer DEFAULT 0,
    total_questions integer DEFAULT 0,
    correct_answers integer DEFAULT 0,
    time_taken integer DEFAULT 0,
    completed_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.competition_attempts OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 17015)
-- Name: competition_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.competition_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competition_attempts_id_seq OWNER TO postgres;

--
-- TOC entry 5297 (class 0 OID 0)
-- Dependencies: 247
-- Name: competition_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.competition_attempts_id_seq OWNED BY public.competition_attempts.id;


--
-- TOC entry 246 (class 1259 OID 16994)
-- Name: competition_questions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.competition_questions (
    id integer NOT NULL,
    competition_id integer,
    question_text text NOT NULL,
    option_a character varying(500) NOT NULL,
    option_b character varying(500) NOT NULL,
    option_c character varying(500),
    option_d character varying(500),
    correct_option character(1) NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.competition_questions OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 16993)
-- Name: competition_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.competition_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competition_questions_id_seq OWNER TO postgres;

--
-- TOC entry 5298 (class 0 OID 0)
-- Dependencies: 245
-- Name: competition_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.competition_questions_id_seq OWNED BY public.competition_questions.id;


--
-- TOC entry 252 (class 1259 OID 17064)
-- Name: competition_words; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.competition_words (
    id integer NOT NULL,
    competition_id integer,
    word character varying(100) NOT NULL,
    clue text,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.competition_words OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 17063)
-- Name: competition_words_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.competition_words_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competition_words_id_seq OWNER TO postgres;

--
-- TOC entry 5299 (class 0 OID 0)
-- Dependencies: 251
-- Name: competition_words_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.competition_words_id_seq OWNED BY public.competition_words.id;


--
-- TOC entry 244 (class 1259 OID 16970)
-- Name: competitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.competitions (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    type character varying(50) DEFAULT 'quiz'::character varying,
    student_group character varying(100),
    time_limit integer DEFAULT 30,
    prize_description text,
    points_per_question integer DEFAULT 10,
    speed_bonus boolean DEFAULT true,
    status character varying(20) DEFAULT 'draft'::character varying,
    starts_at timestamp without time zone,
    ends_at timestamp without time zone,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    programme_name character varying(255)
);


ALTER TABLE public.competitions OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 16969)
-- Name: competitions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.competitions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competitions_id_seq OWNER TO postgres;

--
-- TOC entry 5300 (class 0 OID 0)
-- Dependencies: 243
-- Name: competitions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.competitions_id_seq OWNED BY public.competitions.id;


--
-- TOC entry 228 (class 1259 OID 16805)
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversation_participants (
    id integer NOT NULL,
    conversation_id integer,
    user_id integer,
    joined_at timestamp without time zone DEFAULT now(),
    archived_at timestamp without time zone
);


ALTER TABLE public.conversation_participants OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 16804)
-- Name: conversation_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversation_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversation_participants_id_seq OWNER TO postgres;

--
-- TOC entry 5301 (class 0 OID 0)
-- Dependencies: 227
-- Name: conversation_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversation_participants_id_seq OWNED BY public.conversation_participants.id;


--
-- TOC entry 226 (class 1259 OID 16790)
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    name character varying(255),
    is_group boolean DEFAULT false,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    is_broadcast boolean DEFAULT false
);


ALTER TABLE public.conversations OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16789)
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conversations_id_seq OWNER TO postgres;

--
-- TOC entry 5302 (class 0 OID 0)
-- Dependencies: 225
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- TOC entry 232 (class 1259 OID 16848)
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    event_date date NOT NULL,
    event_time time without time zone,
    type character varying(50) DEFAULT 'event'::character varying,
    role_target character varying(50) DEFAULT 'all'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    student_group character varying(100),
    programme_name character varying(255)
);


ALTER TABLE public.events OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 16847)
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.events_id_seq OWNER TO postgres;

--
-- TOC entry 5303 (class 0 OID 0)
-- Dependencies: 231
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- TOC entry 256 (class 1259 OID 17108)
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feature_flags (
    id integer NOT NULL,
    flag_key character varying(100) NOT NULL,
    enabled boolean DEFAULT true,
    label character varying(255),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.feature_flags OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 17107)
-- Name: feature_flags_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.feature_flags_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.feature_flags_id_seq OWNER TO postgres;

--
-- TOC entry 5304 (class 0 OID 0)
-- Dependencies: 255
-- Name: feature_flags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.feature_flags_id_seq OWNED BY public.feature_flags.id;


--
-- TOC entry 238 (class 1259 OID 16906)
-- Name: forum_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_posts (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.forum_posts OWNER TO postgres;

--
-- TOC entry 237 (class 1259 OID 16905)
-- Name: forum_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.forum_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.forum_posts_id_seq OWNER TO postgres;

--
-- TOC entry 5305 (class 0 OID 0)
-- Dependencies: 237
-- Name: forum_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.forum_posts_id_seq OWNED BY public.forum_posts.id;


--
-- TOC entry 240 (class 1259 OID 16925)
-- Name: forum_replies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_replies (
    id integer NOT NULL,
    post_id integer,
    content text NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.forum_replies OWNER TO postgres;

--
-- TOC entry 239 (class 1259 OID 16924)
-- Name: forum_replies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.forum_replies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.forum_replies_id_seq OWNER TO postgres;

--
-- TOC entry 5306 (class 0 OID 0)
-- Dependencies: 239
-- Name: forum_replies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.forum_replies_id_seq OWNED BY public.forum_replies.id;


--
-- TOC entry 242 (class 1259 OID 16947)
-- Name: forum_upvotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.forum_upvotes (
    id integer NOT NULL,
    post_id integer,
    user_id integer
);


ALTER TABLE public.forum_upvotes OWNER TO postgres;

--
-- TOC entry 241 (class 1259 OID 16946)
-- Name: forum_upvotes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.forum_upvotes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.forum_upvotes_id_seq OWNER TO postgres;

--
-- TOC entry 5307 (class 0 OID 0)
-- Dependencies: 241
-- Name: forum_upvotes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.forum_upvotes_id_seq OWNED BY public.forum_upvotes.id;


--
-- TOC entry 230 (class 1259 OID 16826)
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    conversation_id integer,
    sender_id integer,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 16825)
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.messages_id_seq OWNER TO postgres;

--
-- TOC entry 5308 (class 0 OID 0)
-- Dependencies: 229
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- TOC entry 234 (class 1259 OID 16868)
-- Name: personal_reminders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.personal_reminders (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    reminder_date date NOT NULL,
    reminder_time time without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.personal_reminders OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 16867)
-- Name: personal_reminders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.personal_reminders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.personal_reminders_id_seq OWNER TO postgres;

--
-- TOC entry 5309 (class 0 OID 0)
-- Dependencies: 233
-- Name: personal_reminders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.personal_reminders_id_seq OWNED BY public.personal_reminders.id;


--
-- TOC entry 254 (class 1259 OID 17096)
-- Name: programmes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.programmes (
    id integer NOT NULL,
    programme_code character varying(100),
    programme_name character varying(255),
    programme_year integer,
    nqai_level integer,
    student_group character varying(100),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.programmes OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 17095)
-- Name: programmes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.programmes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.programmes_id_seq OWNER TO postgres;

--
-- TOC entry 5310 (class 0 OID 0)
-- Dependencies: 253
-- Name: programmes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.programmes_id_seq OWNED BY public.programmes.id;


--
-- TOC entry 236 (class 1259 OID 16884)
-- Name: resources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resources (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    file_name character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_type character varying(100) NOT NULL,
    file_size integer,
    category character varying(50) DEFAULT 'general'::character varying,
    role_target character varying(50) DEFAULT 'all'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    student_group character varying(100),
    programme_name character varying(255)
);


ALTER TABLE public.resources OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 16883)
-- Name: resources_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.resources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.resources_id_seq OWNER TO postgres;

--
-- TOC entry 5311 (class 0 OID 0)
-- Dependencies: 235
-- Name: resources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.resources_id_seq OWNED BY public.resources.id;


--
-- TOC entry 220 (class 1259 OID 16732)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password text NOT NULL,
    role character varying(50) DEFAULT 'working'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    suspended boolean DEFAULT false,
    last_login timestamp with time zone,
    force_logout_at timestamp with time zone,
    programme text
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16731)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5312 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 5013 (class 2604 OID 17124)
-- Name: admin_audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_logs ALTER COLUMN id SET DEFAULT nextval('public.admin_audit_logs_id_seq'::regclass);


--
-- TOC entry 4959 (class 2604 OID 16772)
-- Name: announcement_reads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcement_reads ALTER COLUMN id SET DEFAULT nextval('public.announcement_reads_id_seq'::regclass);


--
-- TOC entry 4955 (class 2604 OID 16752)
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- TOC entry 5001 (class 2604 OID 17046)
-- Name: competition_answers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competition_answers ALTER COLUMN id SET DEFAULT nextval('public.competition_answers_id_seq'::regclass);


--
-- TOC entry 4995 (class 2604 OID 17019)
-- Name: competition_attempts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competition_attempts ALTER COLUMN id SET DEFAULT nextval('public.competition_attempts_id_seq'::regclass);


--
-- TOC entry 4992 (class 2604 OID 16997)
-- Name: competition_questions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competition_questions ALTER COLUMN id SET DEFAULT nextval('public.competition_questions_id_seq'::regclass);


--
-- TOC entry 5005 (class 2604 OID 17067)
-- Name: competition_words id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competition_words ALTER COLUMN id SET DEFAULT nextval('public.competition_words_id_seq'::regclass);


--
-- TOC entry 4985 (class 2604 OID 16973)
-- Name: competitions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.competitions ALTER COLUMN id SET DEFAULT nextval('public.competitions_id_seq'::regclass);


--
-- TOC entry 4965 (class 2604 OID 16808)
-- Name: conversation_participants id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversation_participants ALTER COLUMN id SET DEFAULT nextval('public.conversation_participants_id_seq'::regclass);


--
-- TOC entry 4961 (class 2604 OID 16793)
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- TOC entry 4969 (class 2604 OID 16851)
-- Name: events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- TOC entry 5010 (class 2604 OID 17111)
-- Name: feature_flags id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feature_flags ALTER COLUMN id SET DEFAULT nextval('public.feature_flags_id_seq'::regclass);


--
-- TOC entry 4979 (class 2604 OID 16909)
-- Name: forum_posts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_posts ALTER COLUMN id SET DEFAULT nextval('public.forum_posts_id_seq'::regclass);


--
-- TOC entry 4982 (class 2604 OID 16928)
-- Name: forum_replies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_replies ALTER COLUMN id SET DEFAULT nextval('public.forum_replies_id_seq'::regclass);


--
-- TOC entry 4984 (class 2604 OID 16950)
-- Name: forum_upvotes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.forum_upvotes ALTER COLUMN id SET DEFAULT nextval('public.forum_upvotes_id_seq'::regclass);


--
-- TOC entry 4967 (class 2604 OID 16829)
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- TOC entry 4973 (class 2604 OID 16871)
-- Name: personal_reminders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personal_reminders ALTER COLUMN id SET DEFAULT nextval('public.personal_reminders_id_seq'::regclass);


--
-- TOC entry 5008 (class 2604 OID 17099)
-- Name: programmes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.programmes ALTER COLUMN id SET DEFAULT nextval('public.programmes_id_seq'::regclass);


--
-- TOC entry 4975 (class 2604 OID 16887)
-- Name: resources id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resources ALTER COLUMN id SET DEFAULT nextval('public.resources_id_seq'::regclass);


--
-- TOC entry 4951 (class 2604 OID 16735)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5287 (class 0 OID 17121)
-- Dependencies: 258
-- Data for Name: admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_audit_logs (id, admin_id, action, target_user_id, details, created_at) FROM stdin;
1	\N	CREATE_USER	5	Created user admin@tus.ie with role admin	2026-03-21 20:01:13.450226+00
2	5	BULK_DELETE	\N	Bulk deleted 1 users	2026-03-22 15:21:39.930911+00
3	5	FORCE_LOGOUT	5	Forced logout for admin@tus.ie	2026-03-22 15:22:21.015883+00
4	5	FORCE_LOGOUT	5	Forced logout for admin@tus.ie	2026-03-22 15:22:27.541507+00
5	5	FORCE_LOGOUT	5	Forced logout for admin@tus.ie	2026-03-22 16:21:13.712308+00
6	5	SUSPEND_USER	4	SUSPEND_USER for test@gmail.com	2026-03-22 16:21:18.987122+00
7	5	RESET_PASSWORD	3	Password reset for rt@gmail.com	2026-03-22 16:21:29.707855+00
8	5	FORCE_LOGOUT	5	Forced logout for admin@tus.ie	2026-03-22 16:29:11.42878+00
\.


--
-- TOC entry 5253 (class 0 OID 16769)
-- Dependencies: 224
-- Data for Name: announcement_reads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.announcement_reads (id, announcement_id, user_id, read_at) FROM stdin;
10	2	2	2026-03-18 22:23:43.347237
11	4	5	2026-03-22 15:08:22.675864
13	6	5	2026-03-22 16:20:48.451203
\.


--
-- TOC entry 5251 (class 0 OID 16749)
-- Dependencies: 222
-- Data for Name: announcements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.announcements (id, title, content, priority, role_target, created_by, created_at, student_group, programme_name) FROM stdin;
1	ALL STUDENTS	123	low	all	\N	2026-03-13 01:04:06.579666	\N	\N
2	MIDLANDS	123	medium	all	\N	2026-03-13 01:04:13.665905	Ireland-Midlands	\N
3	SUSI	123	high	all	\N	2026-03-13 01:04:20.088417	Ireland-SUSI	\N
4	SB	123	low	all	\N	2026-03-13 01:04:24.555566	SB+	\N
5	MIDDLE EAST	123	high	all	\N	2026-03-13 01:04:40.871987	Middle East	\N
6	INDIA	123	medium	all	\N	2026-03-13 01:04:48.038646	India	\N
7	CHINA	123	low	all	\N	2026-03-13 01:04:51.986253	China	\N
8	AA	A	medium	all	\N	2026-03-13 01:24:23.791904	\N	\N
9	aaa	aaaaaa	high	all	\N	2026-03-19 19:28:44.315385	\N	\N
\.


--
-- TOC entry 5279 (class 0 OID 17043)
-- Dependencies: 250
-- Data for Name: competition_answers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.competition_answers (id, attempt_id, question_id, selected_option, is_correct, time_taken, created_at) FROM stdin;
9	5	5	A	t	3	2026-03-16 00:09:51.946391
10	5	6	B	t	2	2026-03-16 00:09:51.947362
11	6	5	B	f	2	2026-03-16 00:10:13.789839
12	6	6	B	t	3	2026-03-16 00:10:13.790804
\.


--
-- TOC entry 5277 (class 0 OID 17016)
-- Dependencies: 248
-- Data for Name: competition_attempts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.competition_attempts (id, competition_id, user_id, score, total_questions, correct_answers, time_taken, completed_at) FROM stdin;
5	3	2	28	2	2	5	2026-03-16 00:09:51.944848
6	3	3	14	2	1	5	2026-03-16 00:10:13.788543
\.


--
-- TOC entry 5275 (class 0 OID 16994)
-- Dependencies: 246
-- Data for Name: competition_questions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.competition_questions (id, competition_id, question_text, option_a, option_b, option_c, option_d, correct_option, sort_order, created_at) FROM stdin;
5	3	T1	T1	T2	T3	T4	A	0	2026-03-16 00:09:29.591321
6	3	T2	T1	T2	T3	T4	B	1	2026-03-16 00:09:29.593107
\.


--
-- TOC entry 5281 (class 0 OID 17064)
-- Dependencies: 252
-- Data for Name: competition_words; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.competition_words (id, competition_id, word, clue, sort_order, created_at) FROM stdin;
\.


--
-- TOC entry 5273 (class 0 OID 16970)
-- Dependencies: 244
-- Data for Name: competitions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.competitions (id, title, description, type, student_group, time_limit, prize_description, points_per_question, speed_bonus, status, starts_at, ends_at, created_by, created_at, programme_name) FROM stdin;
3	T1	T1	quiz	\N	15	1	10	t	active	\N	\N	\N	2026-03-16 00:09:29.588342	\N
\.


--
-- TOC entry 5257 (class 0 OID 16805)
-- Dependencies: 228
-- Data for Name: conversation_participants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversation_participants (id, conversation_id, user_id, joined_at, archived_at) FROM stdin;
6	3	3	2026-03-13 02:00:43.525606	\N
\.


--
-- TOC entry 5255 (class 0 OID 16790)
-- Dependencies: 226
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.conversations (id, name, is_group, created_by, created_at, is_broadcast) FROM stdin;
3	\N	f	\N	2026-03-13 02:00:43.521368	f
\.


--
-- TOC entry 5261 (class 0 OID 16848)
-- Dependencies: 232
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.events (id, title, description, event_date, event_time, type, role_target, created_by, created_at, student_group, programme_name) FROM stdin;
\.


--
-- TOC entry 5285 (class 0 OID 17108)
-- Dependencies: 256
-- Data for Name: feature_flags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.feature_flags (id, flag_key, enabled, label, updated_at) FROM stdin;
1	announcements	t	Announcements	2026-03-19 19:07:58.225584
2	messages	t	Messages	2026-03-19 19:07:58.225584
3	resources	t	Resources	2026-03-19 19:07:58.225584
4	calendar	f	Calendar	2026-03-19 19:07:58.225584
5	forum	f	Forum	2026-03-19 19:07:58.225584
6	progress	f	Progress	2026-03-19 19:07:58.225584
7	competitions	t	Competitions	2026-03-19 19:07:58.225584
8	group_chat	f	Group Chat	2026-03-19 19:07:58.225584
\.


--
-- TOC entry 5267 (class 0 OID 16906)
-- Dependencies: 238
-- Data for Name: forum_posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.forum_posts (id, title, content, tags, created_by, created_at) FROM stdin;
\.


--
-- TOC entry 5269 (class 0 OID 16925)
-- Dependencies: 240
-- Data for Name: forum_replies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.forum_replies (id, post_id, content, created_by, created_at) FROM stdin;
\.


--
-- TOC entry 5271 (class 0 OID 16947)
-- Dependencies: 242
-- Data for Name: forum_upvotes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.forum_upvotes (id, post_id, user_id) FROM stdin;
\.


--
-- TOC entry 5259 (class 0 OID 16826)
-- Dependencies: 230
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.messages (id, conversation_id, sender_id, content, created_at) FROM stdin;
3	3	\N	T	2026-03-13 02:00:46.588371
\.


--
-- TOC entry 5263 (class 0 OID 16868)
-- Dependencies: 234
-- Data for Name: personal_reminders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.personal_reminders (id, user_id, title, reminder_date, reminder_time, created_at) FROM stdin;
\.


--
-- TOC entry 5283 (class 0 OID 17096)
-- Dependencies: 254
-- Data for Name: programmes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.programmes (id, programme_code, programme_name, programme_year, nqai_level, student_group, created_at) FROM stdin;
1	ALBBADM9CEBAD9	Master of Business Administration	2	9	Ireland-Midlands	2026-03-19 03:04:52.727356
2	ALBFNMM9FNMM	Master of Arts in Financial Management	2	9	Ireland-Midlands	2026-03-19 03:04:52.727356
3	ALBFNMM9JNFMM9	Master of Arts in Financial Management	2	9	Ireland-Midlands	2026-03-19 03:04:52.727356
4	ALBFINM9FNM9	Postgraduate Diploma in Arts in Financial Management	1	9	Ireland-Midlands	2026-03-19 03:04:52.727356
5	ALBFINM9JNFMJ9	Postgraduate Diploma in Arts in Financial Management	2	9	Ireland-Midlands	2026-03-19 03:04:52.727356
6	ALEQMVM9JNQMM9	Master of Science in Quality Management and Validation	2	9	Ireland-Midlands	2026-03-19 03:04:52.727356
7	ALEQMVM9QMVM	Master of Science in Quality Management and Validation	2	9	Ireland-Midlands	2026-03-19 03:04:52.727356
8	ALEQMVD9JNQMJ9	Postgraduate Diploma in Quality Management and Validation	2	9	Ireland-Midlands	2026-03-19 03:04:52.727356
9	AL_BTALE_R09	Masters of Arts in Talent Management (New)	1	9	Ireland-Midlands	2026-03-19 03:04:52.727356
10	AL_BTALE_R09	Masters of Arts in Talent Management (New)	2	9	Ireland-Midlands	2026-03-19 03:04:52.727356
11	AL_BTALE_009	Postgraduate Diploma in Arts in Talent Management	1	9	Ireland-Midlands	2026-03-19 03:04:52.727356
12	New	Certificate in Therapeutic and Creative Play Skills (L9, 10 ECTS)	1	9	Ireland-Midlands	2026-03-19 03:04:52.727356
13	New	Certificate in Applied Management Practice and Leadership in Education	1	9	Ireland-Midlands	2026-03-19 03:04:52.727356
14	New	Certificate in Strategic Talent Leadership and Organisational Psychology	1	9	Ireland-Midlands	2026-03-19 03:04:52.727356
15	New	Certificate in Strategic Risk, Governance and Financial Decision Making	1	9	Ireland-Midlands	2026-03-19 03:04:52.727356
16	New	Certificate in Advanced Quality Systems and Process Excellence	1	9	Ireland-Midlands	2026-03-19 03:04:52.727356
17	AL_BTALE_R09	Masters of Arts in Talent Management	2	9	Middle East	2026-03-19 03:04:52.727356
18	AL_BTALE_R09	Masters of Arts in Talent Management	1	9	Middle East	2026-03-19 03:04:52.727356
19	AL_BEDUD_M09	MA in Educational Innovation, Management and Leadership (New)	1	9	Middle East	2026-03-19 03:04:52.727356
20	AL_BEDUD_M09	MA in Educational Innovation, Management and Leadership (New)	2	9	Middle East	2026-03-19 03:04:52.727356
21	New	Certificate in Therapeutic and Creative Play Skills (L9, 10 ECTS)	1	9	Middle East	2026-03-19 03:04:52.727356
22	New	Certificate in Applied Management Practice and Leadership in Education	1	9	Middle East	2026-03-19 03:04:52.727356
23	AL_BEDUD_M09	MA in Educational Innovation, Management and Leadership (New)	1	9	Ireland-Midlands	2026-03-19 03:04:52.727356
24	AL_BEDUD_M09	MA in Educational Innovation, Management and Leadership (New)	2	9	Ireland-Midlands	2026-03-19 03:04:52.727356
25	ALBSTDA8CEBST8	Bachelor of Business (Honours) in Business	4	8	Ireland-Midlands	2026-03-19 03:04:52.727356
26	ALBSTD77CEBS77	Bachelor of Business in Business	3	7	Ireland-Midlands	2026-03-19 03:04:52.727356
27	ALBSTDA6CEBSA6	Higher Certificate in Business in Business	2	6	Ireland-Midlands	2026-03-19 03:04:52.727356
28	ALBSTDA6CEBSA6	Higher Certificate in Business in Business	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
29	ALSQLMA8QLM8	Bachelor of Science (Honours) in Quality and Lean Management	4	8	Ireland-Midlands	2026-03-19 03:04:52.727356
30	ALSQLMA7QLM7	Apprenticeship Bachelor of Science in Quality and Lean Management	3	7	Ireland-Midlands	2026-03-19 03:04:52.727356
31	ALSQUAL6QUA6	Higher Certificate in Science in Operations Quality and Lean Management	2	6	Ireland-Midlands	2026-03-19 03:04:52.727356
32	AL_BPLSC_8	Bachelor of Business in Sustainable Procurement, Logistics and Supply Chain Management (Hons)	4	8	Ireland-Midlands	2026-03-19 03:04:52.727356
33	AL_BPLSC_7	Bachelor of Business in Sustainable Procurement, Logistics and Supply Chain Management	3	7	Ireland-Midlands	2026-03-19 03:04:52.727356
34	ALBPLSC6PLS6	Higher Certificate in Business in Procurement, Logistics and Supply Chain Management	2	6	Ireland-Midlands	2026-03-19 03:04:52.727356
35	AL_HLAW_BCE	Bachelor of Arts in Law (New)	4	8	Ireland-Midlands	2026-03-19 03:04:52.727356
36	AL_HLAW_BCE	Bachelor of Arts in Law (New)	3	8	Ireland-Midlands	2026-03-19 03:04:52.727356
37	AL_HLAW_BCE	Bachelor of Arts in Law (New)	2	8	Ireland-Midlands	2026-03-19 03:04:52.727356
38	AL_HLAW_BCE	Bachelor of Arts in Law (New)	1	8	Ireland-Midlands	2026-03-19 03:04:52.727356
39	AL_BTLNT_8	Bachelor of Business (Honours) in Strategic Talent Management and Employee Engagement	4	8	Ireland-Midlands	2026-03-19 03:04:52.727356
40	AL_BTLNT_7	Bachelor of Business in Talent Management and Organisational Change	3	7	Ireland-Midlands	2026-03-19 03:04:52.727356
41	AL_BTLNT_6	Higher Certificate in Talent Management	2	6	Ireland-Midlands	2026-03-19 03:04:52.727356
42	AL_BOPMT_8	Higher Diploma in Business Operations Management	1	8	Ireland-Midlands	2026-03-19 03:04:52.727356
43	AL_BREAL_6	Certificate in Real Estate Administration	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
44	AL_BPPWW_6	Certificate in Personal, Professional, Workplace Development and Well-being	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
45	AL_BPRJM_7	Certificate in Introduction to Project Management	1	7	Ireland-Midlands	2026-03-19 03:04:52.727356
46	AL_BCSRV_6	Certificate in Customer Service Excellence	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
47	AL_BOPEX_6	Certificate in Operational Excellence	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
48	AL_BFNQA_6	Certificate in Fundamentals of Quality Assurance	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
49	AL_SOPSY_6	Certificate in Fundamentals of Organisational Psychology	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
50	AL_BPAYM_6	Certificate in Payroll Applications and Management	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
51	AL_BSMSK_6	Certificate in Supervisory Management Skills for Team Leaders	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
52	AL_BMSTP_6	Certificate in Marketing, Sales, Theory and Practice	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
53	AL_BIGMP_6	Certificate in Introduction to Good Manufacturing Practice	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
54	AL_BEMPD_6	Certificate in Employee Development	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
55	AL_BCLAW_6	Certificate in Contract Law, Customs and the Regulatory Environment	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
56	New	Certificate in Fundamentals of CyberSecuriity	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
57	New	Certificate in Foundations of Nutrition for Health and Fitness (L7, 10 ECTS)	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
58	New	Certificate in AI and Emerging Technologies	1	7	Ireland-Midlands	2026-03-19 03:04:52.727356
59	New	Certificate in Applied Entrepreneurship and the Irish Enterprise Ecosystem	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
60	New	Certificate in Irish Language Proficiency (Conversation/Listening)	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
61	New	Certificate in Irish Language Proficiency (Written/Reading)	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
62	New	Certificate in Volunteering	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
63	New	Certificate in Business English Language Acquisition for Professionals	1	6	Ireland-Midlands	2026-03-19 03:04:52.727356
64	AL_BSTDA_8FS	SUSI Bachelor of Business Level 8 (individual Entry)	4	8	Ireland-SUSI	2026-03-19 03:04:52.727356
65	AL_BSTD7_7FS	SUSI Bachelor of Business Level 7 (individual Entry)	3	7	Ireland-SUSI	2026-03-19 03:04:52.727356
66	AL_BSTDA_6FS	SUSI Higher Certificate in Business Year 2 (individual Entry)	2	6	Ireland-SUSI	2026-03-19 03:04:52.727356
67	AL_BSTDA_6FS	SUSI Higher Certificate in Business Year 1 (individual Entry)	1	6	Ireland-SUSI	2026-03-19 03:04:52.727356
68	AL_SQLMA_8FS	SUSI Bachelor of Science in Quality and Lean Management Level 8 (individual Entry)	4	8	Ireland-SUSI	2026-03-19 03:04:52.727356
69	AL_SQLMA_7FS	SUSI Bachelor of Science in Quality and Lean Management Level 7 (individual Entry)	3	7	Ireland-SUSI	2026-03-19 03:04:52.727356
70	AL_SQUAL_6FS	SUSI Higher Certificate in Operations, Quality and Lean Management Year 2 (individual Entry)	2	6	Ireland-SUSI	2026-03-19 03:04:52.727356
71	AL_SQUAL_6FS	SUSI Higher Certificate in Operations, Quality and Lean Management Year 1 (individual Entry)	1	6	Ireland-SUSI	2026-03-19 03:04:52.727356
72	AL_HLAW_8FS	SUSI Bachelor of Arts in Law (Hons)	5	8	Ireland-SUSI	2026-03-19 03:04:52.727356
73	AL_HLAW_8FS	SUSI Bachelor of Arts in Law (Hons)	4	8	Ireland-SUSI	2026-03-19 03:04:52.727356
74	AL_HLAW_8FS	SUSI Bachelor of Arts in Law (Hons)	3	8	Ireland-SUSI	2026-03-19 03:04:52.727356
75	AL_HLAW_8FS	SUSI Bachelor of Arts in Law (Hons)	2	8	Ireland-SUSI	2026-03-19 03:04:52.727356
76	AL_HLAW_8FS	SUSI Bachelor of Arts in Law (Hons)	1	8	Ireland-SUSI	2026-03-19 03:04:52.727356
77	New	Certificate in AI and Emerging Technologies	1	6	Middle East	2026-03-19 03:04:52.727356
78	New	Certificate in Irish Language Proficiency (Conversation/Listening)	1	6	Middle East	2026-03-19 03:04:52.727356
79	New	Certificate in Irish Language Proficiency (Written/Reading)	1	6	Middle East	2026-03-19 03:04:52.727356
80	New	Certificate in Foundations of Nutrition for Health and Fitness (L7, 10 ECTS)	1	6	Middle East	2026-03-19 03:04:52.727356
81	AL_BPPWW_6	Certificate in Personal, Professional, Workplace Development and Well-being	1	6	Middle East	2026-03-19 03:04:52.727356
82	ALBEXEC9EXE9	Postgraduate Diploma in Business in Executive Management	1	9	SB+	2026-03-19 03:04:52.727356
83	ALEQMVD9QMV9	Postgraduate Diploma in Quality Management and Validation	1	9	SB+	2026-03-19 03:04:52.727356
84	\N	MSc Software Cloud NativeC PT	1	9	SB+	2026-03-19 03:04:52.727356
85	\N	PgD in Eng in Eng Management	1	9	SB+	2026-03-19 03:04:52.727356
86	ALBFPAY6FPA6	Certificate in Financial Accounting and Payroll	1	6	SB+	2026-03-19 03:04:52.727356
87	ALBHRMT6HRMT	Special Purpose Award - Certificate in Human Resource Management	1	6	SB+	2026-03-19 03:04:52.727356
88	ALBLSCM6LSC6	Certificate in Logistics and Supply Chain Management	1	6	SB+	2026-03-19 03:04:52.727356
89	ALBSMTL6SMT6	Certificate in Supervisory Management and Team Leadership	1	6	SB+	2026-03-19 03:04:52.727356
90	ALSOQLM6OQL6	Certificate in Operations Quality and Lean Management	1	6	SB+	2026-03-19 03:04:52.727356
91	\N	Certificate in Culinary Skills	1	6	SB+	2026-03-19 03:04:52.727356
92	\N	HC in Culinary Arts PT	1	6	SB+	2026-03-19 03:04:52.727356
93	\N	HD in Bus in Leadership	1	8	SB+	2026-03-19 03:04:52.727356
\.


--
-- TOC entry 5265 (class 0 OID 16884)
-- Dependencies: 236
-- Data for Name: resources; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resources (id, title, description, file_name, file_path, file_type, file_size, category, role_target, created_by, created_at, student_group, programme_name) FROM stdin;
\.


--
-- TOC entry 5249 (class 0 OID 16732)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password, role, created_at, suspended, last_login, force_logout_at, programme) FROM stdin;
2	pt@gmail.com	$2b$10$7AveVGhPcsFSPySxKerhhOonbaEIthan6h4t6pydLVFbUvrAExYM2	student	2026-03-13 01:03:19.730606	f	\N	\N	\N
4	test@gmail.com	$2b$10$YtvuSLJig2C7ltNxhGtHr.sTwgDecXg97uMa/RMymfSX0XucEmkd2	student	2026-03-19 03:02:09.007607	t	\N	\N	\N
3	rt@gmail.com	$2b$10$ByU34ttSHHXXfB.9I7EZEurfOQ7VfWZQ75ume7LEr6hGiUgcT14V6	student	2026-03-13 01:41:10.03051	f	2026-03-22 16:23:11.385215+00	\N	\N
5	admin@tus.ie	$2b$10$JT82WeyNt5z5kwRNoU6/HeMTstKji7V1q/9HrZnT1L8DLWlHFBMPO	admin	2026-03-21 20:01:13.445733	f	2026-03-22 16:30:28.454681+00	2026-03-22 16:29:11.428188+00	\N
\.


--
-- TOC entry 5313 (class 0 OID 0)
-- Dependencies: 257
-- Name: admin_audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admin_audit_logs_id_seq', 8, true);


--
-- TOC entry 5314 (class 0 OID 0)
-- Dependencies: 223
-- Name: announcement_reads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.announcement_reads_id_seq', 14, true);


--
-- TOC entry 5315 (class 0 OID 0)
-- Dependencies: 221
-- Name: announcements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.announcements_id_seq', 9, true);


--
-- TOC entry 5316 (class 0 OID 0)
-- Dependencies: 249
-- Name: competition_answers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.competition_answers_id_seq', 12, true);


--
-- TOC entry 5317 (class 0 OID 0)
-- Dependencies: 247
-- Name: competition_attempts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.competition_attempts_id_seq', 8, true);


--
-- TOC entry 5318 (class 0 OID 0)
-- Dependencies: 245
-- Name: competition_questions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.competition_questions_id_seq', 6, true);


--
-- TOC entry 5319 (class 0 OID 0)
-- Dependencies: 251
-- Name: competition_words_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.competition_words_id_seq', 8, true);


--
-- TOC entry 5320 (class 0 OID 0)
-- Dependencies: 243
-- Name: competitions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.competitions_id_seq', 5, true);


--
-- TOC entry 5321 (class 0 OID 0)
-- Dependencies: 227
-- Name: conversation_participants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversation_participants_id_seq', 6, true);


--
-- TOC entry 5322 (class 0 OID 0)
-- Dependencies: 225
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.conversations_id_seq', 3, true);


--
-- TOC entry 5323 (class 0 OID 0)
-- Dependencies: 231
-- Name: events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.events_id_seq', 1, false);


--
-- TOC entry 5324 (class 0 OID 0)
-- Dependencies: 255
-- Name: feature_flags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.feature_flags_id_seq', 8, true);


--
-- TOC entry 5325 (class 0 OID 0)
-- Dependencies: 237
-- Name: forum_posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.forum_posts_id_seq', 1, false);


--
-- TOC entry 5326 (class 0 OID 0)
-- Dependencies: 239
-- Name: forum_replies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.forum_replies_id_seq', 1, false);


--
-- TOC entry 5327 (class 0 OID 0)
-- Dependencies: 241
-- Name: forum_upvotes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.forum_upvotes_id_seq', 1, false);


--
-- TOC entry 5328 (class 0 OID 0)
-- Dependencies: 229
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.messages_id_seq', 3, true);


--
-- TOC entry 5329 (class 0 OID 0)
-- Dependencies: 233
-- Name: personal_reminders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.personal_reminders_id_seq', 1, false);


--
-- TOC entry 5330 (class 0 OID 0)
-- Dependencies: 253
-- Name: programmes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.programmes_id_seq', 93, true);


--
-- TOC entry 5331 (class 0 OID 0)
-- Dependencies: 235
-- Name: resources_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.resources_id_seq', 1, false);


--
-- TOC entry 5332 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


-- Completed on 2026-03-25 02:52:45

--
-- PostgreSQL database dump complete
--


