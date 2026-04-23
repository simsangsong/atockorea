-- 호텔(숙소) 위치 컬럼 추가 — 서귀포 시내/시외 선택 시 인당 +1.5만 원 반영용
ALTER TABLE proposed_tours
ADD COLUMN IF NOT EXISTS hotel_location TEXT;

COMMENT ON COLUMN proposed_tours.hotel_location IS 'jeju_city | jeju_outside | seogwipo_city | seogwipo_outside. 서귀포 선택 시 요금에 인당 15,000원 반영됨.';
