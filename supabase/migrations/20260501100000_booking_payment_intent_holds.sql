-- 2026-05-01: No-show payment hold infrastructure (Phase 1 + 4 MVP)
--
-- Switches the booking payment flow from immediate full charge to a
-- card-on-file authorization model:
--   * Tour ≤ 7 days away → Stripe PaymentIntent with `capture_method='manual'`
--     (full tour amount is authorized but not charged; auth expires after
--     ~7 days unless captured / canceled).
--   * Tour > 7 days away → Stripe SetupIntent (saves card to a Stripe
--     Customer; no hold today). A daily cron 4-5 days before the tour
--     creates the manual-capture PaymentIntent off-session.
--
-- On attendance: cron / admin cancels the PaymentIntent (no charge).
-- On no-show:    admin captures the PaymentIntent (full tour price).
--
-- Tour cancellation policy: 24h. Free cancel before that window;
-- inside the window, hold is captured per business policy.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS setup_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_intent_status TEXT,
  ADD COLUMN IF NOT EXISTS authorization_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS no_show_fee_usd_cents INTEGER,
  ADD COLUMN IF NOT EXISTS card_collection_method TEXT;

-- Index supports the daily re-auth cron (find SetupIntent-only bookings approaching their tour date).
CREATE INDEX IF NOT EXISTS idx_bookings_card_collection_method_tour_date
  ON bookings(card_collection_method, tour_date)
  WHERE card_collection_method IS NOT NULL
    AND payment_intent_id IS NULL
    AND status = 'confirmed';

-- Index supports finding bookings whose Stripe authorization is about to expire.
CREATE INDEX IF NOT EXISTS idx_bookings_authorization_expires_at
  ON bookings(authorization_expires_at)
  WHERE payment_intent_status = 'authorized';

-- Index supports webhook lookups by PaymentIntent ID.
CREATE INDEX IF NOT EXISTS idx_bookings_payment_intent_id
  ON bookings(payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- Index supports webhook lookups by SetupIntent ID.
CREATE INDEX IF NOT EXISTS idx_bookings_setup_intent_id
  ON bookings(setup_intent_id)
  WHERE setup_intent_id IS NOT NULL;

COMMENT ON COLUMN bookings.payment_intent_id IS
  'Stripe PaymentIntent ID for the no-show authorization hold. Set immediately for ≤7d bookings; populated by the re-auth cron for >7d bookings ~5 days before tour.';
COMMENT ON COLUMN bookings.setup_intent_id IS
  'Stripe SetupIntent ID used to vault the card for >7d bookings. Confirmed off-session by the re-auth cron.';
COMMENT ON COLUMN bookings.stripe_customer_id IS
  'Stripe Customer ID — saved at booking time so the re-auth cron can charge off-session.';
COMMENT ON COLUMN bookings.stripe_payment_method_id IS
  'Default Stripe PaymentMethod attached to the customer (set after SetupIntent succeeds). Used by the re-auth cron.';
COMMENT ON COLUMN bookings.payment_intent_status IS
  'Lifecycle: setup_pending_hold | auth_pending | authorized | captured | canceled | expired | failed.';
COMMENT ON COLUMN bookings.authorization_expires_at IS
  'When Stripe will auto-release the manual-capture hold (typically auth time + 7 days).';
COMMENT ON COLUMN bookings.no_show_fee_usd_cents IS
  'Amount (USD cents) the system will capture on no-show. Defaults to the full tour price per business policy.';
COMMENT ON COLUMN bookings.card_collection_method IS
  'How the card was collected: ''immediate_hold'' (PaymentIntent at booking) or ''setup_intent_then_hold'' (SetupIntent at booking, PI later via cron).';
