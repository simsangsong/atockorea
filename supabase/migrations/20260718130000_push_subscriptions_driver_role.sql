-- Driver web-push: the solo driver backgrounds the console to run a nav app,
-- so guest messages need to ring their device. Widen the role CHECK to allow
-- booking-scoped role='driver' rows (same shape as the 'customer' guest rows).
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_role_check;

alter table public.push_subscriptions
  add constraint push_subscriptions_role_check
  check (role in ('admin', 'guide', 'customer', 'driver'));
