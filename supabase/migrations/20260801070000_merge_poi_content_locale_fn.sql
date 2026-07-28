-- A5 — atomic per-locale merge.
--
-- The translator read a row, spliced one locale into `content_locales`, and
-- wrote the whole object back. Run one locale at a time and that is fine. Run
-- four at once — which is the only way 4 × 117 units finishes in an evening —
-- and each process writes from a snapshot taken before the others' work, so the
-- last writer silently erases the other three locales. Roughly 70 paid
-- translations were lost that way before the row counts gave it away.
--
-- Merging inside the statement makes the write commutative: four processes can
-- touch the same row and each only ever adds its own key.
create or replace function public.merge_poi_content_locale(
  p_poi_key text,
  p_locale text,
  p_entry jsonb,
  p_status text
) returns void
language sql
as $$
  update public.match_pois
  set content_locales =
        coalesce(content_locales, '{}'::jsonb) || jsonb_build_object(p_locale, p_entry),
      content_locale_status =
        coalesce(content_locale_status, '{}'::jsonb) || jsonb_build_object(p_locale, p_status),
      updated_at = now()
  where poi_key = p_poi_key;
$$;

comment on function public.merge_poi_content_locale is
  'Adds ONE locale to match_pois.content_locales/_status without reading the row first, so concurrent per-locale writers cannot clobber each other.';
