-- A4 — a review gate on per-locale POI content.
--
-- `match_pois.content_locales` had no gate: whatever is written there is served
-- to guests immediately, and since the arrival tier landed it is also SPOKEN to
-- them. That was tolerable while every locale in it was human-written. It stops
-- being tolerable the moment machine translation fills fr/de/ru/it, which is
-- the next step — the same hazard CLAUDE.md already flags for
-- `names_other_locales`.
--
-- The rule is deliberately fail-closed: serving uses a locale ONLY when this
-- column says 'approved'. Absent means not approved. A future writer that
-- forgets to set a status therefore stages content invisibly instead of
-- publishing it by accident, which is the whole point of a gate.
--
-- Everything already in content_locales is seeded 'approved' here: it was
-- authored from the curated tour JSONs and is live today, so the gate must not
-- retroactively silence it.

alter table public.match_pois
  add column if not exists content_locale_status jsonb not null default '{}'::jsonb;

comment on column public.match_pois.content_locale_status is
  'Per-locale review state for content_locales, e.g. {"fr":"pending","de":"approved"}. Serving requires "approved" — absent means NOT approved.';

-- Grandfather every locale that already has content.
update public.match_pois m
set content_locale_status = coalesce(
  (
    select jsonb_object_agg(k, 'approved')
    from jsonb_object_keys(m.content_locales) k
  ),
  '{}'::jsonb
)
where m.content_locales is not null
  and m.content_locales::text <> '{}'
  and m.content_locale_status = '{}'::jsonb;

-- The review queue reads "which POIs have a locale waiting", so index the
-- column for containment lookups rather than scanning 124 rows per open.
create index if not exists match_pois_content_locale_status_idx
  on public.match_pois using gin (content_locale_status);
