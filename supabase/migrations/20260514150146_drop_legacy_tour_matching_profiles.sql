-- Drop the legacy 1-5 / smallint matching profile table.
--
-- Live tour matching reads public.match_tours.matching_profile, which stores
-- the 0-1 JSON scoring profile used by lib/tour-match-v2.

DROP TABLE IF EXISTS public.tour_matching_profiles CASCADE;
