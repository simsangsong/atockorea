-- Subtitle-overlay serving for POI videos (video track, 2026-07-26).
--
-- New render mode: ONE language-neutral silent MP4 per POI + per-locale VTT
-- files uploaded alongside. The player overlays the viewer's locale subtitles
-- with a native <track> instead of burned-in text, so a single render serves
-- every language (and adding a locale later = adding one VTT, no re-render).
--
-- Legacy burned-in rows keep subtitle_url NULL and behave exactly as before.
-- Additive + idempotent. Applied live 2026-07-26 via mcp execute_sql.

alter table public.poi_videos add column if not exists subtitle_url text;

comment on column public.poi_videos.subtitle_url is
  'Public VTT URL for subtitle-overlay renders (neutral MP4 + per-locale soft subs). NULL for legacy burned-in renders.';
