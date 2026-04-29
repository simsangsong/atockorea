-- =============================================================================
-- Chatbot conversation log + Q&A workshop + Customer-support escalation pipeline
-- =============================================================================
-- Phase 1: chat_sessions / chat_messages          — every chatbot turn captured
-- Phase 2: qa_pairs                                — vetted Q&A used to train chatbot
-- Phase 3: support_tickets / support_messages     — escalations + admin inbox
-- Phase 4: telegram_webhook_log                    — outbound webhook delivery audit
-- Phase 5: pgvector embedding columns              — future RAG (NULL until populated)
--
-- All tables RLS-enabled. anon = no read/write by default; service_role only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- chat_sessions — one row per browser session that interacts with the chatbot
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token   TEXT UNIQUE NOT NULL,                 -- client-side cookie value (atc_chat_sid)
  user_id         UUID,                                  -- NULL for anonymous; FK soft-link
  user_locale     TEXT,
  user_agent      TEXT,
  ip_hash         TEXT,                                  -- hashed for privacy (never raw)
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_count   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_token        ON public.chat_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_seen    ON public.chat_sessions (last_seen_at DESC);

-- ---------------------------------------------------------------------------
-- chat_messages — every assistant exchange (user_message + assistant_reply)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id                       BIGSERIAL PRIMARY KEY,
  session_id               UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  message_index            INTEGER NOT NULL,            -- per-session monotonic
  role                     TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),

  -- Content
  content                  TEXT NOT NULL,
  user_locale              TEXT,

  -- Page context — where the user invoked the chatbot
  tour_slug                TEXT,                         -- e.g. 'east-signature-nature-core'
  page_url                 TEXT,
  page_title               TEXT,
  page_section             TEXT,                         -- 'overview' / 'itinerary' / 'reviews' / etc.

  -- Telemetry (assistant-side responses)
  model                    TEXT,                         -- 'gemini-2.5-flash' / 'claude-haiku-4-5'
  input_tokens             INTEGER,
  output_tokens            INTEGER,
  cost_usd                 NUMERIC(10, 6),
  elapsed_ms               INTEGER,

  -- Classification (populated by nightly batch)
  category                 TEXT,                         -- e.g. 'pricing_inquiry', 'cancellation', 'pickup_inquiry'
  classification_confidence NUMERIC(4, 3),                -- 0.000–1.000
  classified_at            TIMESTAMPTZ,
  classifier_model         TEXT,

  -- Escalation
  escalated                BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_reason        TEXT,                         -- 'low_confidence' / 'sensitive_topic' / 'user_requested_human'
  ticket_id                BIGINT,                       -- FK set later (after support_tickets created)

  -- Future RAG
  embedding                vector(1536),

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (session_id, message_index)
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_session       ON public.chat_messages (session_id, message_index);
CREATE INDEX IF NOT EXISTS idx_chat_msg_tour          ON public.chat_messages (tour_slug);
CREATE INDEX IF NOT EXISTS idx_chat_msg_category      ON public.chat_messages (category);
CREATE INDEX IF NOT EXISTS idx_chat_msg_unclassified  ON public.chat_messages (created_at DESC) WHERE category IS NULL AND role = 'user';
CREATE INDEX IF NOT EXISTS idx_chat_msg_escalated     ON public.chat_messages (escalated, created_at DESC) WHERE escalated = TRUE;

-- ---------------------------------------------------------------------------
-- qa_pairs — curated Q&A workshop (300-500 entries) used to train the chatbot
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.qa_pairs (
  id                  BIGSERIAL PRIMARY KEY,

  -- Source — where the Q originated
  source              TEXT NOT NULL DEFAULT 'manual',    -- 'manual' | 'chat_message' | 'support_ticket' | 'imported'
  source_message_id   BIGINT,                             -- FK → chat_messages.id (when source='chat_message')
  source_ticket_id    BIGINT,                             -- FK → support_tickets.id (when source='support_ticket')

  -- Q&A content
  question            TEXT NOT NULL,
  answer              TEXT NOT NULL,
  question_locale     TEXT NOT NULL DEFAULT 'ko',
  answer_locale       TEXT NOT NULL DEFAULT 'ko',

  -- Categorization
  category            TEXT,                               -- 'pricing' | 'pickup' | 'cancellation' | ...
  tour_slug           TEXT,                               -- when scoped to a single tour
  tags                TEXT[] NOT NULL DEFAULT '{}',

  -- Workshop / review state — drives the 3-second-per-item review UI
  review_status       TEXT NOT NULL DEFAULT 'draft'
                      CHECK (review_status IN ('draft', 'true', 'false', 'needs_edit', 'approved', 'rejected')),
  reviewed_by         UUID,                               -- admin user id
  reviewed_at         TIMESTAMPTZ,
  edit_history        JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{at, by, prev_answer}, ...]

  -- Use as RAG training corpus when status='approved' AND embedding present
  is_active           BOOLEAN NOT NULL DEFAULT FALSE,     -- only true once approved
  embedding           vector(1536),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_pairs_status       ON public.qa_pairs (review_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_pairs_active       ON public.qa_pairs (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_qa_pairs_category     ON public.qa_pairs (category);
CREATE INDEX IF NOT EXISTS idx_qa_pairs_tour         ON public.qa_pairs (tour_slug);
CREATE INDEX IF NOT EXISTS idx_qa_pairs_tags         ON public.qa_pairs USING GIN (tags);
-- Approved+embedded entries are searched via cosine similarity
CREATE INDEX IF NOT EXISTS idx_qa_pairs_embedding    ON public.qa_pairs USING hnsw (embedding vector_cosine_ops)
  WHERE is_active = TRUE AND embedding IS NOT NULL;

CREATE OR REPLACE FUNCTION public.qa_pairs_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_qa_pairs_updated_at ON public.qa_pairs;
CREATE TRIGGER trg_qa_pairs_updated_at BEFORE UPDATE ON public.qa_pairs FOR EACH ROW EXECUTE FUNCTION public.qa_pairs_set_updated_at();

-- ---------------------------------------------------------------------------
-- support_tickets — escalated chats that need a human admin reply
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id                    BIGSERIAL PRIMARY KEY,
  session_id            UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  trigger_message_id    BIGINT REFERENCES public.chat_messages(id) ON DELETE SET NULL,

  -- Snapshot of context when ticket was opened
  user_locale           TEXT,
  tour_slug             TEXT,
  page_url              TEXT,
  page_title            TEXT,

  -- Why escalated
  escalation_reason     TEXT NOT NULL,                    -- 'low_confidence' | 'sensitive_topic' | 'user_requested_human' | 'no_answer'
  initial_user_message  TEXT NOT NULL,
  initial_summary       TEXT,                              -- short admin-facing summary

  -- State
  status                TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'admin_reading', 'awaiting_admin', 'awaiting_user', 'resolved', 'closed')),
  priority              TEXT NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_admin_id     UUID,
  unread_for_admin      BOOLEAN NOT NULL DEFAULT TRUE,
  unread_for_user       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Telegram / Kakao notification audit
  telegram_notified     BOOLEAN NOT NULL DEFAULT FALSE,
  telegram_message_id   BIGINT,
  telegram_notified_at  TIMESTAMPTZ,
  kakao_notified        BOOLEAN NOT NULL DEFAULT FALSE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status        ON public.support_tickets (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_session       ON public.support_tickets (session_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_unread_admin  ON public.support_tickets (unread_for_admin) WHERE unread_for_admin = TRUE;
CREATE INDEX IF NOT EXISTS idx_support_tickets_tour          ON public.support_tickets (tour_slug);

CREATE OR REPLACE FUNCTION public.support_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.support_set_updated_at();

-- Now that support_tickets exists, set the FK from chat_messages.ticket_id
ALTER TABLE public.chat_messages
  ADD CONSTRAINT fk_chat_messages_ticket
  FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- support_messages — admin↔user reply thread within a ticket
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.support_messages (
  id                BIGSERIAL PRIMARY KEY,
  ticket_id         BIGINT NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_index     INTEGER NOT NULL,
  sender            TEXT NOT NULL CHECK (sender IN ('user', 'admin', 'system')),
  sender_user_id    UUID,
  content           TEXT NOT NULL,
  attachments       JSONB NOT NULL DEFAULT '[]'::jsonb,
  read_at           TIMESTAMPTZ,
  -- For nightly QA-pair extraction
  promoted_to_qa    BOOLEAN NOT NULL DEFAULT FALSE,
  promoted_qa_id    BIGINT REFERENCES public.qa_pairs(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id, message_index)
);

CREATE INDEX IF NOT EXISTS idx_support_msg_ticket  ON public.support_messages (ticket_id, message_index);

-- ---------------------------------------------------------------------------
-- escalation_keywords — admin-curated trigger words that immediately escalate
-- (e.g. legal terms, refund disputes, accessibility hard-asks)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.escalation_keywords (
  id           BIGSERIAL PRIMARY KEY,
  keyword      TEXT NOT NULL,
  locale       TEXT NOT NULL DEFAULT 'ko',
  category     TEXT,                               -- 'legal' | 'refund' | 'medical' | 'complaint'
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (keyword, locale)
);

-- Seed a starting set
INSERT INTO public.escalation_keywords (keyword, locale, category) VALUES
  ('환불',          'ko', 'refund'),
  ('취소수수료',    'ko', 'refund'),
  ('소송',          'ko', 'legal'),
  ('법적',          'ko', 'legal'),
  ('변호사',        'ko', 'legal'),
  ('상해',          'ko', 'medical'),
  ('병원',          'ko', 'medical'),
  ('알레르기',      'ko', 'medical'),
  ('보상',          'ko', 'complaint'),
  ('항의',          'ko', 'complaint'),
  ('관리자',        'ko', 'human_handoff'),
  ('상담원',        'ko', 'human_handoff'),
  ('refund',        'en', 'refund'),
  ('lawsuit',       'en', 'legal'),
  ('attorney',      'en', 'legal'),
  ('injury',        'en', 'medical'),
  ('allergy',       'en', 'medical'),
  ('compensation',  'en', 'complaint'),
  ('human agent',   'en', 'human_handoff'),
  ('speak to manager','en', 'human_handoff')
ON CONFLICT (keyword, locale) DO NOTHING;

-- ---------------------------------------------------------------------------
-- telegram_webhook_log — outbound notification delivery audit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.telegram_webhook_log (
  id                  BIGSERIAL PRIMARY KEY,
  ticket_id           BIGINT REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  endpoint            TEXT NOT NULL,                     -- 'telegram' | 'kakao' | 'manual'
  request_payload     JSONB NOT NULL,
  response_status     INTEGER,
  response_body       JSONB,
  error_message       TEXT,
  delivered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_log_ticket ON public.telegram_webhook_log (ticket_id);

-- ---------------------------------------------------------------------------
-- Row-Level Security — service-role only by default
-- ---------------------------------------------------------------------------

ALTER TABLE public.chat_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_pairs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_keywords    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_webhook_log   ENABLE ROW LEVEL SECURITY;

-- No anon policies on sensitive tables (chat_messages contain PII).
-- escalation_keywords is read-allowable (public taxonomy).
DROP POLICY IF EXISTS p_escalation_anon_read ON public.escalation_keywords;
CREATE POLICY p_escalation_anon_read ON public.escalation_keywords FOR SELECT TO anon USING (TRUE);
