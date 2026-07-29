-- SG-4d — the meeting-point photo pipeline (마스터 플랜 v1.2 §F-3, N-6 승인).
--
-- The ONE missing asset of the fusion track: free-time and rally heroes need
-- a photo of the actual meeting point ("저기가 어디지"를 유일하게 푸는 사진),
-- and no such column existed anywhere. The DRIVER creates it: geofence
-- arrival + no verified photo → one tap in the cockpit → pending here →
-- the ops queue verifies → only verified photos ever reach a guest.
--
-- The bucket is PUBLIC on purpose (meeting points are not PII): signed URLs
-- churn and defeat the tour-room service worker's image cache — the same
-- reason X17's share is text (recorded in lib/tour-room/timelineShare.ts).
alter table tour_poi_arrival_profiles
  add column if not exists meeting_photo_path text,
  add column if not exists meeting_photo_status text not null default 'pending'
    check (meeting_photo_status in ('pending', 'verified', 'rejected')),
  add column if not exists meeting_photo_meta jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public)
values ('tour-meeting-points', 'tour-meeting-points', true)
on conflict (id) do nothing;
