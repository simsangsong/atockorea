-- =============================================================================
-- Upgrade: parsed_intent_cache 이전 형태(cache_key 전용) → 자연키(normalized_input)
-- =============================================================================
-- 적용 대상: 예전 13100000 초안(cache_key UNIQUE 만 있던 테이블)을 이미 적용한 DB.
-- 신규 설치(최신 13100000 만 적용): 이 파일은 DO 블록이 스킵되고 인덱스/트리거만 idempotent.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parsed_intent_cache'
      AND column_name = 'cache_key'
  )
     AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'parsed_intent_cache'
      AND column_name = 'normalized_input'
  ) THEN

    ALTER TABLE public.parsed_intent_cache ADD COLUMN normalized_input TEXT;
    ALTER TABLE public.parsed_intent_cache ADD COLUMN parse_method TEXT NOT NULL DEFAULT 'rule_only';
    ALTER TABLE public.parsed_intent_cache ADD COLUMN raw_input TEXT;
    ALTER TABLE public.parsed_intent_cache ADD COLUMN hit_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE public.parsed_intent_cache ADD COLUMN last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE public.parsed_intent_cache ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    UPDATE public.parsed_intent_cache SET normalized_input = cache_key WHERE normalized_input IS NULL;

    ALTER TABLE public.parsed_intent_cache ALTER COLUMN normalized_input SET NOT NULL;

    ALTER TABLE public.parsed_intent_cache DROP CONSTRAINT IF EXISTS parsed_intent_cache_cache_key_unique;

    ALTER TABLE public.parsed_intent_cache DROP COLUMN IF EXISTS cache_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'parsed_intent_cache_parse_method_chk'
      AND conrelid = 'public.parsed_intent_cache'::regclass
  ) THEN
    ALTER TABLE public.parsed_intent_cache
      ADD CONSTRAINT parsed_intent_cache_parse_method_chk
      CHECK (parse_method IN ('rule_only', 'rule_plus_llm', 'llm_fallback'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'parsed_intent_cache_hit_count_chk'
      AND conrelid = 'public.parsed_intent_cache'::regclass
  ) THEN
    ALTER TABLE public.parsed_intent_cache
      ADD CONSTRAINT parsed_intent_cache_hit_count_chk CHECK (hit_count >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS parsed_intent_cache_natural_key_uidx
  ON public.parsed_intent_cache (parser_version, locale, normalized_input);

CREATE INDEX IF NOT EXISTS idx_parsed_intent_cache_last_used_at
  ON public.parsed_intent_cache (last_used_at DESC);

DROP TRIGGER IF EXISTS trg_parsed_intent_cache_updated_at ON public.parsed_intent_cache;
CREATE TRIGGER trg_parsed_intent_cache_updated_at
  BEFORE UPDATE ON public.parsed_intent_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
