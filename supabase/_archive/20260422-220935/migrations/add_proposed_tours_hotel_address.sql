-- 발의자 호텔 주소·좌표 (참가 시 10km 이내 체크용)
ALTER TABLE proposed_tours
ADD COLUMN IF NOT EXISTS hotel_address TEXT,
ADD COLUMN IF NOT EXISTS hotel_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS hotel_lng DOUBLE PRECISION;

COMMENT ON COLUMN proposed_tours.hotel_address IS 'Proposer hotel address for display and join distance check.';
COMMENT ON COLUMN proposed_tours.hotel_lat IS 'Latitude of proposer hotel (for 10km join limit).';
COMMENT ON COLUMN proposed_tours.hotel_lng IS 'Longitude of proposer hotel (for 10km join limit).';
