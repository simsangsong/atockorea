# 제주 남부 유네스코 명소 버스 투어 추가 가이드

이 가이드는 이미지에 보이는 "Jeju: Southern Top UNESCO Spots Bus Tour"와 동일한 투어를 데이터베이스에 추가하는 방법을 설명합니다.

## 투어 정보

- **제목**: Jeju: Southern Top UNESCO Spots Bus Tour
- **가격**: ₩80,000 per person
- **평점**: 4.9 (637 reviews)
- **시간**: 10 hours
- **언어**: English, Chinese
- **픽업 포인트**: 4개
- **드롭오프 포인트**: 5개

## 주요 장소

1. **Mount Hallasan - Eoseungsangak Trail** (09:30-11:00)
   - 한국 최고봉, 유네스코 자연유산
   - 짧은 트레킹과 파노라마 뷰

2. **Camellia Hill - Jeju's Blossoming Paradise** (11:30-12:30)
   - 6,000그루 이상의 동백나무
   - 선택적 감귤 따기 체험

3. **Lunch at Local Restaurant** (13:00-14:00)
   - 선택 사항, 추가 비용
   - 모든 식이 요구사항 수용

4. **Cheonjeyeon Waterfall - The Pond of the Gods** (14:30-15:30)
   - 3단 폭포, 신들의 연못
   - 울창한 숲과 독특한 암석 형성

5. **Jusangjeolli Cliff** (16:00-17:00)
   - 화산암 기둥, 기하학적 패턴
   - 용암이 바다와 만나 형성

6. **O'sulloc Tea Museum & Green Tea Fields** (17:30-18:00)
   - 차 제조 예술 학습
   - 녹차 밭 산책 및 디저트 시식

## 픽업 포인트

1. **Ocean Suites Jeju** - 08:30
2. **Jeju Airport 3rd Floor, Gate 3** - 08:45
3. **Lotte City Hotel Jeju** - 08:55
4. **Shilla Duty-Free Jeju Store** - 09:05

## 드롭오프 포인트

1. Shilla Duty Free Jeju
2. LOTTE City Hotel Jeju
3. Jeju Airport (CJU)
4. Ocean Suites Jeju Hotel
5. Jeju Dongmun Traditional Market (Self-Guided, Only drop)

## 설치 방법

### 1. Supabase SQL Editor 열기

1. Supabase 대시보드에 로그인
2. 프로젝트 선택
3. 왼쪽 메뉴에서 "SQL Editor" 클릭

### 2. SQL 스크립트 실행

1. `supabase/insert-jeju-southern-unesco-tour.sql` 파일 내용을 복사
2. SQL Editor에 붙여넣기
3. "Run" 버튼 클릭하여 실행

### 3. 확인

스크립트 실행 후 마지막 SELECT 쿼리가 투어 정보와 픽업 포인트 개수를 표시합니다.

```sql
SELECT 
  t.id,
  t.title,
  t.slug,
  t.price,
  t.rating,
  t.review_count,
  COUNT(pp.id) as pickup_points_count
FROM tours t
LEFT JOIN pickup_points pp ON pp.tour_id = t.id
WHERE t.slug = 'jeju-southern-top-unesco-spots-bus-tour'
GROUP BY t.id, t.title, t.slug, t.price, t.rating, t.review_count;
```

예상 결과:
- `title`: "Jeju: Southern Top UNESCO Spots Bus Tour"
- `price`: 80000.00
- `rating`: 4.9
- `review_count`: 637
- `pickup_points_count`: 4

## 웹사이트에서 확인

투어가 성공적으로 추가되면 다음 URL에서 확인할 수 있습니다:

- 투어 목록: `/tours?city=Jeju`
- 투어 상세: `/tour/[tour-id]` (slug: `jeju-southern-top-unesco-spots-bus-tour`)

## 포함 사항

- ✅ 모든 입장권 (입장료)
- ✅ 유네스코 버스 투어
- ✅ 영어 및 중국어 가이드
- ✅ 통행료
- ✅ 주차료
- ✅ 연료비

## 불포함 사항

- ❌ 식사 (점심 비용)
- ❌ 개인 경비
- ❌ 개인 여행 보험

## 주의사항

- 휠체어 사용자에게 적합하지 않음
- 24시간 전 취소 시 전액 환불
- WhatsApp 번호 제공 필요 (투어 전날 그룹 채팅 생성)
- 10분 이상 지각 시 노쇼로 간주되어 환불 불가

## 문제 해결

### 중복 투어 오류

만약 `slug`가 이미 존재한다는 오류가 발생하면:

```sql
-- 기존 투어 삭제 (주의: 관련 예약도 함께 삭제됨)
DELETE FROM tours WHERE slug = 'jeju-southern-top-unesco-spots-bus-tour';
```

그 후 다시 스크립트를 실행하세요.

### 픽업 포인트가 생성되지 않음

픽업 포인트가 생성되지 않았다면:

```sql
-- 투어 ID 확인
SELECT id FROM tours WHERE slug = 'jeju-southern-top-unesco-spots-bus-tour';

-- 수동으로 픽업 포인트 추가 (위에서 얻은 tour_id 사용)
INSERT INTO pickup_points (tour_id, name, address, lat, lng, pickup_time, is_active)
VALUES 
  ('[tour_id]', 'Ocean Suites Jeju', 'Ocean Suites Jeju, 263, Yeon-dong, Jeju-si, Jeju-do', 33.4996, 126.5312, '08:30:00', true),
  ('[tour_id]', 'Jeju Airport 3rd Floor, Gate 3', 'Jeju International Airport, 2 Gonghang-ro, Jeju-si, Jeju-do', 33.5113, 126.4930, '08:45:00', true),
  ('[tour_id]', 'Lotte City Hotel Jeju', 'Lotte City Hotel Jeju, 83 Doryeong-ro, Jeju-si, Jeju-do', 33.4996, 126.5312, '08:55:00', true),
  ('[tour_id]', 'Shilla Duty-Free Jeju Store', 'Shilla Duty-Free Jeju Store, Jeju-si, Jeju-do', 33.4996, 126.5312, '09:05:00', true);
```





