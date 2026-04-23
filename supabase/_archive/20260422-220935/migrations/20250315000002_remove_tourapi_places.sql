-- Tour API 출처 places 행 삭제 (LOD만 사용할 경우)
-- 적용 전 확인: SELECT source_origin, COUNT(*) FROM places GROUP BY source_origin;

DELETE FROM places
WHERE source_origin IS DISTINCT FROM 'lod';

-- 삭제 후 (선택) 통계 확인
-- SELECT COUNT(*) AS remaining FROM places;
