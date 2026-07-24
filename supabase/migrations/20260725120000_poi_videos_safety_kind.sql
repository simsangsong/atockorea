-- 30-second safety video — reuse the poi_videos pipeline (plan §5.6 / §7 Phase 4).
--
-- Additive only (D2). Instead of a parallel table + a parallel review queue,
-- the safety film becomes a second *kind* of row in poi_videos, so
-- `npm run video:upload`, /admin/poi-videos, the approval gate, and the
-- one-approved-version-per-(poi_key, language) auto-supersede all keep working
-- unchanged.
--
-- Shape of the safety row:
--   kind      = 'safety'
--   poi_key   = '__safety_intro_30s'   (sentinel — the film has no POI)
--   language  = 'mul'                  (ISO 639-2 "multiple"; the render is
--                                       SILENT and carries no burned subtitles,
--                                       the 10 languages ship as WebVTT tracks
--                                       from public/videos/safety-intro-30s/)
--
-- Existing rows are untouched: `kind` defaults to 'poi', which is exactly what
-- every current row is.

begin;

alter table public.poi_videos
  add column if not exists kind text not null default 'poi';

alter table public.poi_videos
  drop constraint if exists poi_videos_kind_check;
alter table public.poi_videos
  add constraint poi_videos_kind_check check (kind in ('poi', 'safety'));

-- Widen the language whitelist by exactly one value.
alter table public.poi_videos
  drop constraint if exists poi_videos_language_check;
alter table public.poi_videos
  add constraint poi_videos_language_check
  check (language in ('en', 'zh-Hant', 'ja', 'es', 'mul'));

-- 'mul' is legal only on a safety row, and a safety row is always 'mul' —
-- so a POI render can never accidentally claim to be language-neutral, and a
-- safety render can never be filed under one language.
alter table public.poi_videos
  drop constraint if exists poi_videos_safety_language_check;
alter table public.poi_videos
  add constraint poi_videos_safety_language_check
  check ((kind = 'safety') = (language = 'mul'));

-- The serving query is `kind='safety' and status='approved'` ordered by version.
create index if not exists poi_videos_safety_serving_idx
  on public.poi_videos (kind, status, version desc)
  where kind = 'safety';

comment on column public.poi_videos.kind is
  'poi = per-POI short (one MP4 per language, burned subtitles); safety = the 30s silent safety film (one MP4, WebVTT tracks served from /public).';

commit;
