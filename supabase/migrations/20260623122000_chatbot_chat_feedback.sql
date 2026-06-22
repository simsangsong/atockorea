-- Chatbot feedback signal: thumbs up/down on assistant answers.
-- Feeds quality-weighted harvest + coverage-gap analytics (Phase 3/4).

create table if not exists public.chat_feedback (
  id            bigint generated always as identity primary key,
  session_token text,
  message_id    bigint references public.chat_messages(id) on delete set null,
  tour_slug     text,
  locale        text,
  rating        smallint not null check (rating in (-1, 1)),
  question      text,
  answer        text,
  reason        text,
  page_url      text,
  created_at    timestamptz not null default now()
);

comment on table public.chat_feedback is
  'Thumbs up/down feedback on assistant answers. Drives quality signal + coverage-gap analytics.';

create index if not exists chat_feedback_rating_idx on public.chat_feedback (rating, created_at desc);
create index if not exists chat_feedback_created_idx on public.chat_feedback (created_at desc);
create index if not exists chat_feedback_tour_idx on public.chat_feedback (tour_slug);

alter table public.chat_feedback enable row level security;
