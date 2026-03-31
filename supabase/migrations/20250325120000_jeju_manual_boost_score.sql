-- Additive admin ranking signal for itinerary candidate ordering (does not replace manual_priority)

ALTER TABLE public.jeju_kor_tourapi_places
  ADD COLUMN IF NOT EXISTS manual_boost_score NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.jeju_kor_tourapi_places.manual_boost_score IS
  'Additive push for generation candidate ranking; distinct from manual_priority (operator ordering / tie-break semantics)';
