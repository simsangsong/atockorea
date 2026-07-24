alter table public.tour_day_plans add column if not exists departure_time text;
comment on column public.tour_day_plans.departure_time is 'Guest-set daily departure time HH:MM (KST), §11.D D4. Countdown target = departure_time + base hours (overtime.ts baseHoursForCity). Null until the lead guest sets it in the plan editor.';
