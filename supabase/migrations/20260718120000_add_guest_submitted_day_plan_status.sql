-- Smart Guide private mode P0: submitted guest drafts need their own review state.
alter table public.tour_day_plans
  drop constraint if exists tour_day_plans_status_check;

alter table public.tour_day_plans
  add constraint tour_day_plans_status_check
  check (status in ('guest_draft', 'guest_submitted', 'guide_confirmed', 'live', 'done'));
