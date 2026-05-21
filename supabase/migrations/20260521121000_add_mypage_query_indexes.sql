-- Query indexes for mypage booking, wishlist, and review reads.
CREATE INDEX IF NOT EXISTS idx_bookings_pickup_point_id
  ON public.bookings (pickup_point_id);

CREATE INDEX IF NOT EXISTS idx_bookings_user_created_at_desc
  ON public.bookings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_user_status_tour_date
  ON public.bookings (user_id, status, tour_date);

CREATE INDEX IF NOT EXISTS idx_reviews_user_created_at_desc
  ON public.reviews (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wishlist_user_created_at_desc
  ON public.wishlist (user_id, created_at DESC);
