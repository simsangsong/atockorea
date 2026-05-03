-- 2026-05-01: Extend booking status / payment_status CHECK constraints
-- to support the no-show authorization hold lifecycle.
--
-- payment_status now allows 'authorized' — set when the customer's card has
-- been auth-held (no charge yet) and cleared by capture or cancel later.
-- status now allows 'no_show' — set when the admin marks a booking as
-- no-show, triggering capture of the payment hold.

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check CHECK (
  payment_status = ANY (ARRAY['pending'::text, 'authorized'::text, 'paid'::text, 'refunded'::text, 'partially_refunded'::text])
);

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (
  status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])
);
