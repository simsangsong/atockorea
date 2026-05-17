-- 2026-05-17: Self-built product analytics schema (Phase 1 Foundation).
-- Master plan: docs/atockorea-analytics-master-plan-2026-05-17.md §6
--
-- Tables:
--   analytics_events       raw event stream
--   analytics_sessions     session metadata (one row per session)
--   analytics_users        anonymous_id ↔ user_id merge mapping
--   analytics_funnels      named funnel definitions (Phase 3)
--   analytics_experiments  A/B variant config (Phase 6)
--
-- Materialized views:
--   analytics_events_daily, analytics_sessions_daily (refreshed hourly via cron)
--
-- Notes:
--   - RLS: insert is service_role-only, read requires the admin claim
--     baked into our existing requireAdmin() check.
--   - PII guard: payload is jsonb but the ingestion endpoint Zod-validates
--     against an allowlist. Schema doesn't enforce content shape.
--   - 90-day anonymization runs as a separate cron (Phase 7) and uses the
--     anonymized_at column on rows to flag soft-deletion.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- identity
  anonymous_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text NOT NULL,

  -- context
  page_path text,
  page_query jsonb,
  referrer text,
  locale text,
  viewport_width integer,
  viewport_height integer,
  device_class text CHECK (device_class IN ('mobile', 'tablet', 'desktop', 'unknown')),
  user_agent_family text,
  country_code text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,

  -- experiment context (auto-attached if any experiments active)
  experiment_assignments jsonb DEFAULT '{}'::jsonb,

  -- timestamps
  client_ts timestamptz NOT NULL,
  server_ts timestamptz NOT NULL DEFAULT now(),

  -- soft anonymization
  anonymized_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_ts
  ON public.analytics_events (event_name, server_ts DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON public.analytics_events (session_id, server_ts);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user
  ON public.analytics_events (user_id, server_ts DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_anonymous
  ON public.analytics_events (anonymous_id, server_ts);

CREATE TABLE IF NOT EXISTS public.analytics_sessions (
  id text PRIMARY KEY,
  anonymous_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  started_at timestamptz NOT NULL,
  last_event_at timestamptz NOT NULL,
  event_count integer NOT NULL DEFAULT 0,
  page_view_count integer NOT NULL DEFAULT 0,

  entry_path text,
  entry_referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,

  device_class text,
  viewport_width integer,
  locale text,
  country_code text,

  converted boolean NOT NULL DEFAULT false,
  converted_at timestamptz,
  converted_event text,

  anonymized_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_started
  ON public.analytics_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_anon
  ON public.analytics_sessions (anonymous_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_user
  ON public.analytics_sessions (user_id, started_at DESC)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.analytics_users (
  anonymous_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merged_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_users_user
  ON public.analytics_users (user_id);

CREATE TABLE IF NOT EXISTS public.analytics_funnels (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  steps jsonb NOT NULL,
  conversion_window_seconds integer NOT NULL DEFAULT 1800,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_experiments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  description text,
  status text NOT NULL CHECK (status IN ('draft', 'running', 'paused', 'concluded')) DEFAULT 'draft',
  variants jsonb NOT NULL,
  primary_metric_funnel_key text REFERENCES public.analytics_funnels(key),
  start_date timestamptz,
  end_date timestamptz,
  conclusion_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- Materialized views (hourly refresh via cron — Phase 7 wires up the cron)
-- =========================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.analytics_events_daily AS
SELECT
  date_trunc('day', server_ts) AS day,
  event_name,
  locale,
  device_class,
  count(*) AS event_count,
  count(DISTINCT session_id) AS session_count,
  count(DISTINCT COALESCE(user_id::text, anonymous_id)) AS user_count
FROM public.analytics_events
WHERE anonymized_at IS NULL
  AND server_ts >= now() - interval '90 days'
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_events_daily_unique
  ON public.analytics_events_daily (day, event_name, locale, device_class);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.analytics_sessions_daily AS
SELECT
  date_trunc('day', started_at) AS day,
  locale,
  device_class,
  utm_source,
  count(*) AS session_count,
  count(DISTINCT anonymous_id) AS unique_visitor_count,
  count(*) FILTER (WHERE converted) AS conversion_count,
  avg(event_count)::numeric(10, 2) AS avg_events_per_session,
  avg(extract(epoch FROM (last_event_at - started_at)))::numeric(10, 2) AS avg_duration_seconds
FROM public.analytics_sessions
WHERE anonymized_at IS NULL
  AND started_at >= now() - interval '90 days'
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_sessions_daily_unique
  ON public.analytics_sessions_daily (day, locale, device_class, utm_source);

-- =========================================================================
-- Row Level Security
-- =========================================================================

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_experiments ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS, so insert from the ingestion endpoint (using
-- the service-role key server-side) is allowed without a policy. We keep
-- policies tight for anything coming through anon/authenticated clients.

CREATE POLICY analytics_events_admin_read
  ON public.analytics_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY analytics_sessions_admin_read
  ON public.analytics_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY analytics_users_admin_read
  ON public.analytics_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY analytics_funnels_admin_read
  ON public.analytics_funnels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

CREATE POLICY analytics_experiments_admin_read
  ON public.analytics_experiments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- =========================================================================
-- Seed: 5 predefined funnels (Phase 3 will surface them in admin UI).
-- =========================================================================

INSERT INTO public.analytics_funnels (key, name, description, steps) VALUES
  (
    'matcher_funnel',
    '매처 펀널 (8단계)',
    'page view → intent focus → CTA → loading → result → result card click → tour detail → checkout',
    '[
      {"event_name": "page_view", "filter": {"page_path": "/"}, "label": "랜딩 페이지뷰"},
      {"event_name": "home_hero_intent_focus", "filter": null, "label": "intent textarea 포커스"},
      {"event_name": "home_cta_click", "filter": {"source": "hero_planner_match"}, "label": "매처 CTA 클릭"},
      {"event_name": "home_match_preview_visible", "filter": {"phase": "loading"}, "label": "결과 로딩 노출"},
      {"event_name": "home_match_preview_visible", "filter": {"phase": "result"}, "label": "결과 노출"},
      {"event_name": "home_cta_click", "filter": {"source": "best_match_result_primary"}, "label": "결과 카드 클릭"},
      {"event_name": "page_view", "filter": {"page_path_like": "/tour-product/%"}, "label": "투어 상세 페이지뷰"},
      {"event_name": "checkout_started", "filter": null, "label": "체크아웃 시작"}
    ]'::jsonb
  ),
  (
    'featured_pickup_funnel',
    'Featured 상품 픽업 펀널',
    'home → featured card click (regular_section) → tour detail → checkout → payment complete',
    '[
      {"event_name": "page_view", "filter": {"page_path": "/"}, "label": "랜딩 페이지뷰"},
      {"event_name": "home_featured_card_click", "filter": {"source": "regular_section"}, "label": "Featured 카드 클릭"},
      {"event_name": "page_view", "filter": {"page_path_like": "/tour-product/%"}, "label": "투어 상세 페이지뷰"},
      {"event_name": "checkout_started", "filter": null, "label": "체크아웃 시작"},
      {"event_name": "checkout_payment_completed", "filter": null, "label": "결제 완료"}
    ]'::jsonb
  ),
  (
    'idle_preview_funnel',
    'Idle preview 참여 펀널',
    'home → idle preview visible → idle preview card click → tour detail',
    '[
      {"event_name": "page_view", "filter": {"page_path": "/"}, "label": "랜딩 페이지뷰"},
      {"event_name": "home_match_preview_visible", "filter": {"phase": "idle"}, "label": "Idle 캐러셀 노출"},
      {"event_name": "home_featured_card_click", "filter": {"source": "idle_preview"}, "label": "Idle 카드 클릭"},
      {"event_name": "page_view", "filter": {"page_path_like": "/tour-product/%"}, "label": "투어 상세 페이지뷰"}
    ]'::jsonb
  ),
  (
    'destinations_funnel',
    'Destinations 분기 펀널',
    'home → destination card click → tours/list view',
    '[
      {"event_name": "page_view", "filter": {"page_path": "/"}, "label": "랜딩 페이지뷰"},
      {"event_name": "home_destination_card_click", "filter": null, "label": "Destination 카드 클릭"},
      {"event_name": "page_view", "filter": {"page_path_like": "/tours/list%"}, "label": "투어 리스트 페이지뷰"}
    ]'::jsonb
  ),
  (
    'tour_mode_funnel',
    'Tour-mode 펀널 (PR 4 wiring 후 활성)',
    'booking confirmed → tour-mode page → spot event triggered → completed',
    '[
      {"event_name": "booking_confirmed", "filter": null, "label": "예약 확정"},
      {"event_name": "page_view", "filter": {"page_path_like": "/tour-mode/%"}, "label": "Tour-mode 페이지뷰"},
      {"event_name": "tour_room_spot_event_triggered", "filter": null, "label": "Spot event 트리거"},
      {"event_name": "tour_completed", "filter": null, "label": "투어 완료"}
    ]'::jsonb
  )
ON CONFLICT (key) DO NOTHING;
