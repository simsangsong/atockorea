# 투어 관리 가이드 (Tour Management Guide)

투어를 추가하는 방법은 세 가지가 있습니다:

## 방법 1: 개별 SQL 스크립트 실행 (현재 방식)

각 투어마다 별도의 SQL 파일을 Supabase SQL Editor에서 실행합니다.

**장점:**
- 투어별로 독립적으로 관리 가능
- 특정 투어만 추가/수정 가능

**단점:**
- 투어마다 수동 실행 필요
- 여러 투어 추가 시 반복 작업

**사용법:**
1. Supabase Dashboard → SQL Editor 열기
2. `supabase/insert-[tour-name].sql` 파일 내용 복사
3. SQL Editor에 붙여넣기
4. Run 버튼 클릭

## 방법 2: 통합 SQL 스크립트 (추천)

모든 투어를 한 번에 추가할 수 있는 통합 스크립트를 사용합니다.

**장점:**
- 한 번의 실행으로 모든 투어 추가
- 초기 데이터 설정에 편리

**단점:**
- 이미 존재하는 투어는 중복 생성 시도 시 오류 발생
- 특정 투어만 추가하기 어려움

**사용법:**
1. `supabase/insert-all-tours.sql` 파일의 각 투어 섹션을 순서대로 복사
2. Supabase SQL Editor에 붙여넣기
3. Run 버튼 클릭

**주의사항:**
- 이미 존재하는 투어(slug가 중복)는 에러가 발생하므로 해당 섹션을 건너뛰세요
- 또는 `INSERT ... ON CONFLICT (slug) DO NOTHING`을 사용하여 중복을 무시할 수 있습니다

## 방법 3: 관리자 API 엔드포인트 (가장 편리)

API를 통해 프로그래밍 방식으로 투어를 추가합니다.

**장점:**
- 코드로 자동화 가능
- 웹 인터페이스 구축 가능
- 검증 및 오류 처리 자동화

**단점:**
- 초기 설정 필요 (Admin 권한 설정)
- 개발 지식 필요

**사용법:**

### 3.1 Admin 권한 설정

먼저 사용자에게 Admin 권한을 부여해야 합니다:

```sql
-- Supabase SQL Editor에서 실행
UPDATE user_profiles 
SET role = 'admin' 
WHERE id = 'your-user-id';
```

### 3.2 API 사용 예시

**JavaScript/TypeScript:**

```typescript
const response = await fetch('/api/admin/tours', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // 인증 헤더는 자동으로 추가됨 (쿠키 기반)
  },
  body: JSON.stringify({
    title: 'Jeju: Test Tour',
    slug: 'jeju-test-tour',
    city: 'Jeju',
    price: 80000,
    price_type: 'person',
    image_url: 'https://example.com/image.jpg',
    description: 'Test tour description',
    duration: '8 hours',
    highlights: ['Highlight 1', 'Highlight 2'],
    includes: ['Include 1', 'Include 2'],
    excludes: ['Exclude 1'],
    schedule: [
      {
        time: '08:00',
        title: 'Pickup',
        description: 'Hotel pickup'
      }
    ],
    pickup_points: [
      {
        name: 'Jeju Airport',
        address: 'Jeju International Airport',
        lat: 33.5113,
        lng: 126.4930,
        pickup_time: '08:00:00'
      }
    ]
  })
});

const result = await response.json();
console.log(result);
```

**cURL:**

```bash
curl -X POST http://localhost:3000/api/admin/tours \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "title": "Jeju: Test Tour",
    "slug": "jeju-test-tour",
    "city": "Jeju",
    "price": 80000,
    "price_type": "person",
    "image_url": "https://example.com/image.jpg"
  }'
```

### 3.3 API 엔드포인트

**POST `/api/admin/tours`**
- 새 투어 생성
- Admin 권한 필요
- 필수 필드: `title`, `slug`, `city`, `price`, `price_type`, `image_url`

**GET `/api/admin/tours`**
- 모든 투어 조회 (Admin만)
- 쿼리 파라미터:
  - `is_active`: `true` 또는 `false`
  - `city`: `Jeju`, `Busan`, `Seoul`

## 추천 워크플로우

1. **초기 데이터 설정**: 방법 2 (통합 스크립트) 사용
2. **개별 투어 추가**: 방법 1 (개별 스크립트) 또는 방법 3 (API) 사용
3. **대량/자동화**: 방법 3 (API) 사용

## 문제 해결

### 중복 투어 오류

```
ERROR: duplicate key value violates unique constraint "tours_slug_key"
```

**해결책:**
- 해당 투어의 SQL 섹션을 건너뛰기
- 또는 slug를 변경하여 새 투어로 생성

### Admin 권한 없음 오류

```
{ "error": "Admin access required" }
```

**해결책:**
- `user_profiles` 테이블에서 사용자의 `role`을 `'admin'`으로 설정
- 또는 merchant 계정으로 로그인하여 `/api/merchant/products` 사용

## 추가 개선 사항

향후 개선 가능한 사항:
- [ ] 관리자 대시보드 UI (투어 추가/수정 인터페이스)
- [ ] CSV/Excel 파일에서 대량 가져오기
- [ ] 투어 템플릿 시스템
- [ ] 이미지 자동 업로드 기능








