-- 2026-05-15: Atomic merchant settlement creation.
--
-- Keeps payout settlement creation in one database transaction so API callers
-- cannot leave orphan settlements or race across overlapping settlement runs.

CREATE OR REPLACE FUNCTION public.create_merchant_settlement(
  p_merchant_id uuid,
  p_period_start date,
  p_period_end date,
  p_platform_fee_rate numeric DEFAULT 0.10
)
RETURNS public.settlements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settlement public.settlements;
  v_total_revenue numeric;
  v_total_bookings integer;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_period_start IS NULL OR p_period_end IS NULL THEN
    RAISE EXCEPTION 'settlement period is required' USING ERRCODE = '22023';
  END IF;

  IF p_period_start > p_period_end THEN
    RAISE EXCEPTION 'settlement period start must be on or before end' USING ERRCODE = '22023';
  END IF;

  IF p_platform_fee_rate < 0 OR p_platform_fee_rate > 1 THEN
    RAISE EXCEPTION 'platform fee rate must be between 0 and 1' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.merchants WHERE id = p_merchant_id) THEN
    RAISE EXCEPTION 'merchant not found' USING ERRCODE = 'P0002';
  END IF;

  CREATE TEMP TABLE pg_temp.settlement_candidate_bookings ON COMMIT DROP AS
  SELECT b.id, b.final_price
  FROM public.bookings b
  WHERE b.merchant_id = p_merchant_id
    AND b.payment_status = 'paid'
    AND b.status = 'completed'
    AND b.settlement_status = 'pending'
    AND b.booking_date >= p_period_start
    AND b.booking_date <= p_period_end
    AND NOT EXISTS (
      SELECT 1
      FROM public.settlement_bookings sb
      WHERE sb.booking_id = b.id
    )
  FOR UPDATE OF b;

  SELECT COALESCE(SUM(final_price), 0), COUNT(*)
  INTO v_total_revenue, v_total_bookings
  FROM pg_temp.settlement_candidate_bookings;

  IF v_total_bookings = 0 THEN
    RAISE EXCEPTION 'no bookings found for settlement period' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.settlements (
    merchant_id,
    settlement_period_start,
    settlement_period_end,
    total_revenue,
    platform_fee,
    merchant_payout,
    total_bookings,
    status
  )
  VALUES (
    p_merchant_id,
    p_period_start,
    p_period_end,
    v_total_revenue,
    ROUND(v_total_revenue * p_platform_fee_rate, 2),
    ROUND(v_total_revenue * (1 - p_platform_fee_rate), 2),
    v_total_bookings,
    'pending'
  )
  RETURNING * INTO v_settlement;

  INSERT INTO public.settlement_bookings (
    settlement_id,
    booking_id,
    booking_revenue,
    platform_fee_amount,
    merchant_payout_amount
  )
  SELECT
    v_settlement.id,
    id,
    final_price,
    ROUND(final_price * p_platform_fee_rate, 2),
    ROUND(final_price * (1 - p_platform_fee_rate), 2)
  FROM pg_temp.settlement_candidate_bookings;

  RETURN v_settlement;
END;
$$;

