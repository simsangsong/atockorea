-- ============================================================
-- 02 / Truncate test data (pre-launch reset)
-- ============================================================
--
-- Wipes every row from application tables so we can re-seed from
-- scratch with only East + Jeju. Admin auth.users rows are preserved
-- by explicit allow-list filter on user_profiles.
--
-- IMPORTANT: This assumes no real customer data exists yet.
-- Only run once in pre-launch. After go-live, use targeted
-- DELETE/UPDATE statements instead.
--
-- ⚠️  Before you run this you MUST also manually delete non-admin
-- rows in auth.users via the Supabase Dashboard (Auth > Users).
-- We cannot touch auth.users from SQL Editor because Supabase
-- restricts direct writes.
-- ============================================================

BEGIN;

-- --- 1. Transactional data (order matters: children first) ----
TRUNCATE TABLE public.settlement_bookings RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.settlements RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.promo_code_usage RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.cart_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.wishlist RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.bookings RESTART IDENTITY CASCADE;

-- --- 2. Review surfaces (keep table shape, drop all rows) -----
-- `review_reactions` / `review_reports` may not exist in every env.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'review_reactions') THEN
    EXECUTE 'TRUNCATE TABLE public.review_reactions RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'review_reports') THEN
    EXECUTE 'TRUNCATE TABLE public.review_reports RESTART IDENTITY CASCADE';
  END IF;
END $$;
TRUNCATE TABLE public.reviews RESTART IDENTITY CASCADE;

-- --- 3. Inventory + product catalog ----------------------------
TRUNCATE TABLE public.product_inventory RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.pickup_points RESTART IDENTITY CASCADE;

-- Matching profiles / tour product pages / offers are re-seeded by
-- the per-product generator (`scripts/gen-tour-product-sql.mjs`), so
-- wipe them here.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'tour_matching_profiles') THEN
    EXECUTE 'TRUNCATE TABLE public.tour_matching_profiles RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'tour_product_offers') THEN
    EXECUTE 'TRUNCATE TABLE public.tour_product_offers RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'tour_product_pages') THEN
    EXECUTE 'TRUNCATE TABLE public.tour_product_pages RESTART IDENTITY CASCADE';
  END IF;
END $$;

TRUNCATE TABLE public.tours RESTART IDENTITY CASCADE;

-- --- 4. Promo codes ------------------------------------------
TRUNCATE TABLE public.promo_codes RESTART IDENTITY CASCADE;

-- --- 5. Ops surfaces -----------------------------------------
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    EXECUTE 'TRUNCATE TABLE public.notifications RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'contact_inquiries') THEN
    EXECUTE 'TRUNCATE TABLE public.contact_inquiries RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'received_emails') THEN
    EXECUTE 'TRUNCATE TABLE public.received_emails RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'email_replies') THEN
    EXECUTE 'TRUNCATE TABLE public.email_replies RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'error_logs') THEN
    EXECUTE 'TRUNCATE TABLE public.error_logs RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    EXECUTE 'TRUNCATE TABLE public.audit_logs RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'verification_codes') THEN
    EXECUTE 'TRUNCATE TABLE public.verification_codes RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- --- 6. CMS / homepage overrides (drop so defaults apply) ----
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'site_settings') THEN
    EXECUTE 'TRUNCATE TABLE public.site_settings RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- --- 7. Merchant tables ---------------------------------------
-- Keep tables, drop rows. Re-seed a single AtoC Korea merchant from
-- the product generator (or insert manually) once admin is ready.
TRUNCATE TABLE public.merchant_settings RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.merchants RESTART IDENTITY CASCADE;

-- --- 8. user_profiles: keep admin rows only -------------------
-- ⚠️  Replace the email list with your real admin email(s) BEFORE
-- running. Any row whose auth email is NOT in the list is deleted.
DELETE FROM public.user_profiles
WHERE id NOT IN (
  SELECT id FROM auth.users
  WHERE email IN (
    -- 👇 EDIT THIS LIST BEFORE EXECUTION 👇
    'admin@atockorea.com'
  )
);

COMMIT;

-- ============================================================
-- Verification (read-only). Run after COMMIT.
-- ============================================================
-- SELECT table_name,
--        (xpath('/row/c/text()',
--               query_to_xml(format('SELECT COUNT(*) AS c FROM %I.%I',
--                                   table_schema, table_name), true, true, ''))
--        )[1]::text::bigint AS row_count
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
-- ORDER BY table_name;
