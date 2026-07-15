-- V4.2 — travel-timeline reward coupon (concierge-uiux-v2 plan §E).
--
-- Reuses the welcome-coupon promo_codes + coupon_grants model (migration
-- 20260708000000). This only seeds ONE promo_code row; the tour-room
-- endpoint /api/tour-rooms/[bookingId]/timeline-coupon issues per-user grants
-- against it (idempotent via coupon_grants' unique (promo_code_id, user_id)).
--
-- Ships launch-gated (is_active = false, exactly like WELCOME10): until ops
-- decides the discount is live, the endpoint reports `not_available` and
-- grants nothing. Flip is_active = true (and confirm discount_value) at launch.
--
-- Additive + idempotent: no schema change, on-conflict-do-nothing on code.

insert into public.promo_codes (
  code,
  description,
  discount_type,
  discount_value,
  min_purchase_amount,
  max_discount_amount,
  max_uses,
  is_active,
  requires_login,
  first_purchase_only,
  usage_limit_per_user,
  auto_grant_on_email_confirm,
  grant_validity_days
) values (
  'TIMELINE10',
  'Travel timeline reward - 10% off your next tour for completing your trip timeline',
  'percentage',
  10,
  0,
  null,
  null,
  false,           -- launch gate: flip to true when ops activates the reward
  true,            -- grant is bound to an auth user
  false,           -- returning-customer reward, not first-purchase-only
  1,               -- one per customer (enforced by coupon_grants unique constraint)
  false,           -- issued by the tour-room endpoint, not the email-confirm trigger
  60               -- grant expires 60 days after issue
)
on conflict (code) do nothing;
