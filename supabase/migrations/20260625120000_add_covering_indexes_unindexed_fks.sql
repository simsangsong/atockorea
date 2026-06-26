-- Add covering indexes for foreign keys flagged by Supabase performance advisor
-- (unindexed_foreign_keys, 24 FKs). Indexing the referencing column speeds up
-- joins and, more importantly, cascade UPDATE/DELETE on the referenced table.
-- All additive + idempotent (CREATE INDEX IF NOT EXISTS) — zero behavior change.
-- NOTE: at current scale most of these tables are tiny (<=1.4k rows); this is
-- hygiene / future-proofing, not a fix for present-day read latency.

create index if not exists idx_analytics_experiments_primary_metric_funnel_key
  on public.analytics_experiments (primary_metric_funnel_key);
create index if not exists idx_analytics_funnels_created_by
  on public.analytics_funnels (created_by);
create index if not exists idx_cart_items_pickup_point_id
  on public.cart_items (pickup_point_id);
create index if not exists idx_chat_feedback_message_id
  on public.chat_feedback (message_id);
create index if not exists idx_chat_messages_ticket_id
  on public.chat_messages (ticket_id);
create index if not exists idx_emails_tour_id
  on public.emails (tour_id);
create index if not exists idx_quote_memory_source_quote_request_id
  on public.quote_memory (source_quote_request_id);
create index if not exists idx_received_emails_related_booking_id
  on public.received_emails (related_booking_id);
create index if not exists idx_received_emails_related_user_id
  on public.received_emails (related_user_id);
create index if not exists idx_support_messages_promoted_qa_id
  on public.support_messages (promoted_qa_id);
create index if not exists idx_support_tickets_trigger_message_id
  on public.support_tickets (trigger_message_id);
create index if not exists idx_tour_audio_assets_job_id
  on public.tour_audio_assets (job_id);
create index if not exists idx_tour_audio_assets_tour_id
  on public.tour_audio_assets (tour_id);
create index if not exists idx_tour_bus_details_created_by
  on public.tour_bus_details (created_by);
create index if not exists idx_tour_content_jobs_created_by
  on public.tour_content_jobs (created_by);
create index if not exists idx_tour_content_jobs_tour_id
  on public.tour_content_jobs (tour_id);
create index if not exists idx_tour_generated_courses_tour_id
  on public.tour_generated_courses (tour_id);
create index if not exists idx_tour_quote_requests_precedent_quote_id
  on public.tour_quote_requests (precedent_quote_id);
create index if not exists idx_tour_room_messages_booking_id
  on public.tour_room_messages (booking_id);
create index if not exists idx_tour_room_messages_sender_user_id
  on public.tour_room_messages (sender_user_id);
create index if not exists idx_tour_room_spot_events_message_id
  on public.tour_room_spot_events (message_id);
create index if not exists idx_tour_room_spot_events_spot_id
  on public.tour_room_spot_events (spot_id);
create index if not exists idx_tour_room_spot_events_triggered_by_user_id
  on public.tour_room_spot_events (triggered_by_user_id);
create index if not exists idx_tour_rooms_tour_id
  on public.tour_rooms (tour_id);
