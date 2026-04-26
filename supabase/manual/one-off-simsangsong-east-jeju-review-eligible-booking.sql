-- One-off: simsangsong@gmail.com → 동부(East Jeju) 투어 리뷰 작성 플로우 테스트용
-- ----------------------------------------------------------------------------
-- 조건(앱 코드와 동일):
--   • bookings.status = 'completed'
--   • 해당 booking에 연결된 reviews 행 없음
--   • tour_date 가 “서울 기준 어제 이전”이면 리뷰 작성 시간 제한 통과
--     (lib/review-write-window.ts / isReviewWriteWindowOpen)
--
-- 실행: Supabase Dashboard → SQL Editor → 전체 실행 (postgres / service role)
-- 실행 후: 해당 계정으로 로그인 → /mypage 또는 /mypage/history 에서 리뷰 작성 진입
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  v_email constant text := 'simsangsong@gmail.com';
  v_user_id uuid;
  v_tour_id uuid;
  v_merchant_id uuid;
  v_price numeric;
  v_tour_date date;
  v_booking_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.users 에 % 가 없습니다. 먼저 회원가입/로그인으로 계정을 만드세요.', v_email;
  END IF;

  -- 동부 소그룹 플래그십 SKU 우선, 없으면 east-signature-nature-core
  SELECT t.id, t.merchant_id, t.price
  INTO v_tour_id, v_merchant_id, v_price
  FROM public.tours t
  WHERE t.is_active IS NOT FALSE
    AND lower(t.slug) IN (
      'east-jeju-signature-small-group',
      'east-signature-nature-core'
    )
  ORDER BY
    CASE lower(t.slug)
      WHEN 'east-jeju-signature-small-group' THEN 0
      WHEN 'east-signature-nature-core' THEN 1
    END
  LIMIT 1;

  IF v_tour_id IS NULL THEN
    RAISE EXCEPTION 'public.tours 에 east-jeju-signature-small-group / east-signature-nature-core 행이 없습니다. 시드/마이그레이션 확인.';
  END IF;

  -- 어제(서울 달력): 당일 13시 제한 없이 리뷰 창 열림
  v_tour_date := (timezone('Asia/Seoul', now()))::date - 1;

  -- 이미 “완료 + 미리뷰” 예약이 있으면 tour_date 만 맞춤 (중복 방지)
  SELECT b.id INTO v_booking_id
  FROM public.bookings b
  LEFT JOIN public.reviews r ON r.booking_id = b.id
  WHERE b.user_id = v_user_id
    AND b.tour_id = v_tour_id
    AND b.status = 'completed'
    AND r.id IS NULL
  ORDER BY b.created_at DESC
  LIMIT 1;

  IF v_booking_id IS NOT NULL THEN
    UPDATE public.bookings
    SET
      tour_date = v_tour_date,
      booking_date = LEAST(booking_date, v_tour_date),
      updated_at = now()
    WHERE id = v_booking_id;

    RAISE NOTICE '기존 예약 % 를 리뷰 가능하도록 tour_date=% 로 맞춤 (user %, tour %).',
      v_booking_id, v_tour_date, v_user_id, v_tour_id;
    RETURN;
  END IF;

  INSERT INTO public.bookings (
    user_id,
    tour_id,
    merchant_id,
    booking_date,
    tour_date,
    number_of_guests,
    unit_price,
    total_price,
    final_price,
    status,
    payment_status,
    payment_method,
    contact_email
  )
  VALUES (
    v_user_id,
    v_tour_id,
    v_merchant_id,
    v_tour_date,
    v_tour_date,
    1,
    v_price,
    v_price,
    v_price,
    'completed',
    'paid',
    'manual_one_off_seed',
    v_email
  )
  RETURNING id INTO v_booking_id;

  RAISE NOTICE '예약 생성 완료 booking_id=% tour_id=% tour_date=% user=%',
    v_booking_id, v_tour_id, v_tour_date, v_user_id;
END $$;
