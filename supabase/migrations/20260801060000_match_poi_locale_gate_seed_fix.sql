-- A4 fix 1 — the English master lives in the TOP-LEVEL columns for some rows,
-- not in content_locales.en. Seeding only from content_locales keys therefore
-- gated live English prose behind an 'en' key that never existed, which
-- silently dropped jagalchi_market and osulloc_tea_museum out of the tier.
--
-- `poi_key not like '\_%'` skips the two `_metadata` bookkeeping rows.
update public.match_pois
set content_locale_status = content_locale_status || jsonb_build_object('en', 'approved')
where content_locale_status->>'en' is distinct from 'approved'
  and description is not null
  and length(description) > 80
  and poi_key not like '\_%';

-- A4 fix 2 — fr/de/ru/it have NEVER been customer-visible: the itinerary
-- builder's locale allowlist excludes them, and the arrival tier that would
-- serve them shipped the same day as this gate. Grandfathering them as
-- 'approved' would publish, in one step, the exact content the gate was
-- requested for. They start pending and wait for a human.
update public.match_pois
set content_locale_status = content_locale_status
  || (
    select coalesce(jsonb_object_agg(k, 'pending'), '{}'::jsonb)
    from jsonb_object_keys(content_locales) k
    where k in ('fr', 'de', 'ru', 'it')
  )
where content_locales is not null
  and content_locales ?| array['fr', 'de', 'ru', 'it'];
