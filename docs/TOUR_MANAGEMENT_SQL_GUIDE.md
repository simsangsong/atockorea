# 투어 관리 SQL 가이드

## SQL 방식의 장점

1. **직접 제어**: Supabase SQL Editor에서 직접 실행하여 즉시 확인 가능
2. **데이터 복사/수정 용이**: 기존 투어 데이터를 복사해서 새 투어 생성 가능
3. **일괄 처리**: 여러 투어를 한 번에 추가 가능
4. **버전 관리**: SQL 파일로 Git에 저장하여 변경 이력 관리 가능
5. **인증 불필요**: 브라우저 콘솔이나 API 인증 없이 바로 실행

## 투어 추가 방법

### 1. Supabase SQL Editor 사용

1. Supabase Dashboard 접속
2. 왼쪽 메뉴에서 **SQL Editor** 클릭
3. **New query** 클릭
4. `supabase/insert-*.sql` 파일 내용 복사
5. SQL Editor에 붙여넣기
6. **Run** 버튼 클릭 (또는 `Ctrl + Enter`)

### 2. 기존 투어 복사해서 새 투어 만들기

1. Supabase에서 기존 투어 데이터 확인:
```sql
SELECT * FROM tours WHERE slug = '기존-투어-slug';
```

2. 데이터 복사 후 수정:
   - `title`, `slug` 변경
   - `city`, `price` 등 필요한 필드 수정
   - `pickup_points`도 함께 복사/수정

### 3. 투어 수정하기

```sql
-- 투어 기본 정보 수정
UPDATE tours 
SET 
  title = '새로운 제목',
  price = 100000,
  description = '새로운 설명',
  is_active = true,
  is_featured = false
WHERE slug = '투어-slug';

-- 가격 수정
UPDATE tours 
SET price = 95000, original_price = 120000
WHERE slug = '투어-slug';

-- 활성화/비활성화
UPDATE tours 
SET is_active = false
WHERE slug = '투어-slug';

-- Featured 설정
UPDATE tours 
SET is_featured = true
WHERE slug = '투어-slug';
```

## 투어 템플릿

### 기본 투어 템플릿

```sql
WITH new_tour AS (
  INSERT INTO tours (
    title,
    slug,
    city,
    tag,
    subtitle,
    description,
    price,
    original_price,
    price_type,
    image_url,
    gallery_images,
    duration,
    lunch_included,
    ticket_included,
    pickup_info,
    notes,
    highlights,
    includes,
    excludes,
    schedule,
    faqs,
    rating,
    review_count,
    pickup_points_count,
    dropoff_points_count,
    is_active,
    is_featured
  ) VALUES (
    '투어 제목',
    'tour-slug',  -- URL에 사용되는 고유 slug
    'Seoul',      -- 'Seoul', 'Busan', 'Jeju' 중 하나
    'Tag',        -- 태그 (예: 'Culture', 'Nature', 'Cruise')
    '부제목',
    '상세 설명...',
    100000.00,    -- 가격
    120000.00,    -- 원래 가격 (할인 전, 없으면 NULL)
    'person',     -- 'person' 또는 'group'
    'https://example.com/image.jpg',  -- 메인 이미지 URL
    '["https://example.com/gallery1.jpg", "https://example.com/gallery2.jpg"]'::jsonb,  -- 갤러리 이미지 배열
    '8 hours',    -- 소요 시간
    false,        -- 점심 포함 여부
    true,         -- 티켓 포함 여부
    '픽업 정보...',
    '참고사항...',
    '["하이라이트 1", "하이라이트 2"]'::jsonb,  -- 하이라이트 배열
    '["포함사항 1", "포함사항 2"]'::jsonb,      -- 포함사항 배열
    '["제외사항 1", "제외사항 2"]'::jsonb,      -- 제외사항 배열
    '[{"time": "09:00", "title": "첫 번째 장소", "description": "설명"}]'::jsonb,  -- 일정 배열
    '[{"question": "질문", "answer": "답변"}]'::jsonb,  -- FAQ 배열
    4.5,          -- 평점
    50,           -- 리뷰 수
    2,            -- 픽업 포인트 수
    2,            -- 하차 포인트 수
    true,         -- 활성화 여부
    false         -- Featured 여부
  )
  RETURNING id
)
INSERT INTO pickup_points (tour_id, name, address, lat, lng, pickup_time)
SELECT 
  new_tour.id,
  '픽업 포인트 이름',
  '주소',
  37.5665,  -- 위도
  126.9780, -- 경도
  '09:00'   -- 픽업 시간 (NULL 가능)
FROM new_tour;
```

## 투어 수정 SQL 템플릿

### 전체 필드 수정

```sql
-- 1. 기존 투어 데이터 확인
SELECT * FROM tours WHERE slug = 'tour-slug';

-- 2. 투어 수정
UPDATE tours 
SET 
  title = '수정된 제목',
  description = '수정된 설명',
  price = 95000,
  original_price = 110000,
  image_url = 'https://new-image-url.com/image.jpg',
  gallery_images = '["url1", "url2"]'::jsonb,
  highlights = '["하이라이트 1", "하이라이트 2"]'::jsonb,
  includes = '["포함 1", "포함 2"]'::jsonb,
  excludes = '["제외 1", "제외 2"]'::jsonb,
  schedule = '[{"time": "09:00", "title": "장소", "description": "설명"}]'::jsonb,
  faqs = '[{"question": "Q", "answer": "A"}]'::jsonb,
  is_active = true,
  is_featured = true,
  updated_at = NOW()
WHERE slug = 'tour-slug';

-- 3. 픽업 포인트 수정
-- 기존 픽업 포인트 삭제 후 재생성
DELETE FROM pickup_points WHERE tour_id = (SELECT id FROM tours WHERE slug = 'tour-slug');

INSERT INTO pickup_points (tour_id, name, address, lat, lng, pickup_time)
SELECT 
  id,
  '새 픽업 포인트',
  '새 주소',
  37.5665,
  126.9780,
  '09:00'
FROM tours WHERE slug = 'tour-slug';
```

### 부분 수정 (필요한 필드만)

```sql
-- 가격만 수정
UPDATE tours 
SET price = 90000, updated_at = NOW()
WHERE slug = 'tour-slug';

-- 설명만 수정
UPDATE tours 
SET description = '새로운 설명', updated_at = NOW()
WHERE slug = 'tour-slug';

-- 이미지만 수정
UPDATE tours 
SET image_url = 'https://new-url.com/image.jpg', updated_at = NOW()
WHERE slug = 'tour-slug';

-- 활성화 상태만 변경
UPDATE tours 
SET is_active = false, updated_at = NOW()
WHERE slug = 'tour-slug';
```

## 투어 삭제

```sql
-- 픽업 포인트 먼저 삭제
DELETE FROM pickup_points 
WHERE tour_id = (SELECT id FROM tours WHERE slug = 'tour-slug');

-- 투어 삭제
DELETE FROM tours WHERE slug = 'tour-slug';
```

## 투어 복사 (기존 투어를 복사해서 새 투어 만들기)

```sql
-- 1. 기존 투어와 픽업 포인트를 함께 복사
WITH copied_tour AS (
  INSERT INTO tours (
    title, slug, city, tag, subtitle, description,
    price, original_price, price_type, image_url, gallery_images,
    duration, lunch_included, ticket_included, pickup_info, notes,
    highlights, includes, excludes, schedule, faqs,
    rating, review_count, pickup_points_count, dropoff_points_count,
    is_active, is_featured
  )
  SELECT 
    title || ' (Copy)',  -- 제목에 (Copy) 추가
    slug || '-copy',     -- slug에 -copy 추가
    city, tag, subtitle, description,
    price, original_price, price_type, image_url, gallery_images,
    duration, lunch_included, ticket_included, pickup_info, notes,
    highlights, includes, excludes, schedule, faqs,
    rating, review_count, pickup_points_count, dropoff_points_count,
    false,  -- 새로 복사한 투어는 비활성화
    false   -- Featured도 false로
  FROM tours
  WHERE slug = '기존-투어-slug'
  RETURNING id
)
INSERT INTO pickup_points (tour_id, name, address, lat, lng, pickup_time)
SELECT 
  copied_tour.id,
  pp.name,
  pp.address,
  pp.lat,
  pp.lng,
  pp.pickup_time
FROM copied_tour
CROSS JOIN pickup_points pp
WHERE pp.tour_id = (SELECT id FROM tours WHERE slug = '기존-투어-slug');
```

## 유용한 쿼리

### 모든 투어 목록 확인

```sql
SELECT 
  id,
  title,
  slug,
  city,
  price,
  is_active,
  is_featured,
  rating,
  review_count,
  created_at
FROM tours
ORDER BY created_at DESC;
```

### 특정 도시의 투어만 확인

```sql
SELECT * FROM tours WHERE city = 'Seoul' ORDER BY created_at DESC;
```

### 활성화된 투어만 확인

```sql
SELECT * FROM tours WHERE is_active = true ORDER BY rating DESC;
```

### Featured 투어 확인

```sql
SELECT * FROM tours WHERE is_featured = true ORDER BY rating DESC;
```

### 투어와 픽업 포인트 함께 확인

```sql
SELECT 
  t.*,
  json_agg(
    json_build_object(
      'id', pp.id,
      'name', pp.name,
      'address', pp.address,
      'lat', pp.lat,
      'lng', pp.lng,
      'pickup_time', pp.pickup_time
    )
  ) as pickup_points
FROM tours t
LEFT JOIN pickup_points pp ON pp.tour_id = t.id
WHERE t.slug = 'tour-slug'
GROUP BY t.id;
```

## 주의사항

1. **slug는 고유해야 함**: 같은 slug가 있으면 에러 발생
2. **JSON 형식**: `gallery_images`, `highlights`, `includes`, `excludes`, `schedule`, `faqs`는 JSON 형식으로 작성
3. **문자열 이스케이프**: SQL에서 작은따옴표(`'`)는 두 개(`''`)로 작성
4. **날짜 형식**: `created_at`, `updated_at`은 자동으로 설정되지만 필요시 `NOW()` 사용

## 작업 흐름

1. **새 투어 추가**: `supabase/insert-*.sql` 파일 참고해서 새 SQL 작성
2. **Supabase SQL Editor에서 실행**
3. **결과 확인**: SELECT 쿼리로 확인
4. **수정 필요시**: UPDATE 쿼리로 수정
5. **Git에 저장**: SQL 파일을 Git에 커밋하여 버전 관리

## 예시: 기존 투어 수정하기

```sql
-- 1. 현재 데이터 확인
SELECT title, price, description, is_active 
FROM tours 
WHERE slug = 'jeju-island-full-day-tour-cruise-passengers';

-- 2. 가격 수정
UPDATE tours 
SET price = 95000, updated_at = NOW()
WHERE slug = 'jeju-island-full-day-tour-cruise-passengers';

-- 3. 결과 확인
SELECT title, price FROM tours 
WHERE slug = 'jeju-island-full-day-tour-cruise-passengers';
```

이 방식이면 브라우저 콘솔이나 API 인증 없이도 Supabase에서 직접 투어를 관리할 수 있습니다!
