-- Welcome coupon core: extend promo_codes (definition layer, additive), add
-- coupon_grants (per-user issuance) + coupon_redemptions (booking-bound ledger),
-- RLS (self select + admin; writes are service-role only), and auto-grant trigger
-- on auth.users email confirmation. WELCOME10 seeded INACTIVE (launch flip later).
-- Applied to live via MCP apply_migration `welcome_coupon_grants_core` on 2026-07-08.

-- 1) promo_codes additive extension
alter table public.promo_codes
  add column if not exists requires_login boolean not null default false,
  add column if not exists first_purchase_only boolean not null default false,
  add column if not exists usage_limit_per_user int,
  add column if not exists auto_grant_on_email_confirm boolean not null default false,
  add column if not exists grant_validity_days int;

-- 2) coupon_grants: per-user issuance of a promo code
create table if not exists public.coupon_grants (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active','locked','redeemed','expired','revoked')),
  expires_at timestamptz,
  locked_booking_id uuid references public.bookings(id) on delete set null,
  granted_at timestamptz not null default now(),
  redeemed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (promo_code_id, user_id)
);
comment on table public.coupon_grants is
  'Per-user coupon issuance (welcome coupon etc). Lock point = booking creation (card-on-file hold model), not PI creation. Writes are service-role only.';
create index if not exists coupon_grants_user_status_idx
  on public.coupon_grants (user_id, status);
create index if not exists coupon_grants_locked_booking_idx
  on public.coupon_grants (locked_booking_id) where locked_booking_id is not null;

-- 3) coupon_redemptions: usage ledger bound to a booking; PI id filled when the
--    hold is minted (checkout for <=7d bookings, recapture cron for >7d).
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.coupon_grants(id),
  promo_code_id uuid not null references public.promo_codes(id),
  user_id uuid not null references auth.users(id),
  booking_id uuid not null unique references public.bookings(id),
  payment_intent_id text unique,
  subtotal_major numeric not null,
  discount_major numeric not null,
  final_major numeric not null,
  subtotal_minor bigint not null,
  discount_minor bigint not null,
  final_minor bigint not null,
  currency text not null,
  status text not null default 'pending'
    check (status in ('pending','captured','released')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
comment on table public.coupon_redemptions is
  'Coupon usage ledger, one row per discounted booking. pending -> captured (PI succeeded) | released (cancel/expire/abandon sweep). Writes are service-role only.';
create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions (user_id);
create index if not exists coupon_redemptions_grant_idx on public.coupon_redemptions (grant_id);
create index if not exists coupon_redemptions_status_idx on public.coupon_redemptions (status);

-- 4) RLS: self select + admin select; no write policies (service role bypasses RLS)
alter table public.coupon_grants enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists "Users can view own coupon grants" on public.coupon_grants;
create policy "Users can view own coupon grants" on public.coupon_grants
  for select to authenticated
  using ((select auth.uid()) = user_id or private.current_profile_role() = 'admin');

drop policy if exists "Users can view own coupon redemptions" on public.coupon_redemptions;
create policy "Users can view own coupon redemptions" on public.coupon_redemptions
  for select to authenticated
  using ((select auth.uid()) = user_id or private.current_profile_role() = 'admin');

-- 5) auto-grant on email confirmation (INSERT with confirmed email covers OAuth;
--    UPDATE transition covers native email OTP signups)
create or replace function public.handle_email_confirmed_coupon_grant()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if (tg_op = 'INSERT' and new.email_confirmed_at is not null)
     or (tg_op = 'UPDATE' and old.email_confirmed_at is null and new.email_confirmed_at is not null) then
    insert into public.coupon_grants (promo_code_id, user_id, expires_at)
    select pc.id, new.id,
           case when pc.grant_validity_days is not null
                then now() + make_interval(days => pc.grant_validity_days)
                else null end
    from public.promo_codes pc
    where pc.auto_grant_on_email_confirm = true
      and pc.is_active = true
      and (pc.valid_from is null or pc.valid_from <= now())
      and (pc.valid_until is null or pc.valid_until > now())
    on conflict (promo_code_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed_grant on auth.users;
create trigger on_auth_user_email_confirmed_grant
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.handle_email_confirmed_coupon_grant();

-- 6) Seed WELCOME10 (INACTIVE until code ships; flip is_active at launch)
insert into public.promo_codes (
  code, description, discount_type, discount_value,
  min_purchase_amount, max_discount_amount, max_uses,
  is_active, requires_login, first_purchase_only,
  usage_limit_per_user, auto_grant_on_email_confirm, grant_validity_days
) values (
  'WELCOME10', 'Welcome coupon - 10% off first booking for new members', 'percentage', 10,
  0, null, null,
  false, true, true,
  1, true, 30
)
on conflict (code) do nothing;
