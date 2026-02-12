# 투어 수정 가이드

## 📋 개요

API로 추가한 투어를 수정하는 방법은 여러 가지가 있습니다:

1. **브라우저 콘솔 스크립트 사용** (가장 쉬움) ✅
2. **Admin 페이지에서 수정** (UI 제공되는 경우)
3. **SQL 직접 수정** (Supabase SQL Editor)
4. **제가 도와드리기** (요청하시면 파일 수정) ✅

---

## 방법 1: 브라우저 콘솔 스크립트 사용 (권장)

### 단계별 가이드

#### 1단계: 수정 스크립트 준비

`scripts/update-tour.js` 파일을 열어서 수정할 데이터를 설정하세요:

```javascript
// 투어 찾기 (slug 또는 ID)
const tourSlugOrId = 'jeju-southern-unesco-geopark-day-tour';

// 수정할 데이터 (변경하고 싶은 필드만 포함)
const updateData = {
  price: 85000,              // 가격 수정
  original_price: 100000,    // 원래 가격 수정
  is_featured: true,         // 추천 설정
  // title: "새로운 제목",   // 제목 수정 (예시)
  // description: "새 설명", // 설명 수정 (예시)
};
```

#### 2단계: 실행

1. `/admin` 페이지에서 Admin 계정으로 로그인
2. 브라우저 콘솔 열기 (F12)
3. `scripts/update-tour.js` 파일 내용 복사
4. `tourSlugOrId`와 `updateData` 수정
5. 콘솔에 붙여넣기 후 Enter

#### 3단계: 결과 확인

- ✅ 성공: 콘솔에 "투어 수정 성공!" 메시지
- ❌ 실패: 에러 메시지 확인

---

## 방법 2: 간단한 수정 스크립트

특정 필드만 빠르게 수정하려면:

```javascript
(async () => {
  // 토큰 가져오기
  let token = null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('auth-token')) {
      const data = JSON.parse(localStorage.getItem(key));
      token = data?.access_token || data?.accessToken || data?.session?.access_token;
      if (token) break;
    }
  }
  
  // 투어 ID (수정할 투어)
  const tourId = '투어-ID-여기에';
  
  // 수정할 데이터
  const updateData = {
    price: 85000,
    is_featured: true
  };
  
  // API 호출
  const response = await fetch(`/api/tours/${tourId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    credentials: 'include',
    body: JSON.stringify(updateData)
  });
  
  const result = await response.json();
  if (result.success) {
    console.log('✅ 수정 성공!', result.data);
  } else {
    console.error('❌ 수정 실패:', result.error);
  }
})();
```

---

## 방법 3: SQL 직접 수정 (Supabase SQL Editor)

SQL을 직접 수정하고 싶은 경우:

```sql
-- 투어 가격 수정
UPDATE tours 
SET price = 85000, original_price = 100000
WHERE slug = 'jeju-southern-unesco-geopark-day-tour';

-- 투어 제목 수정
UPDATE tours 
SET title = '새로운 제목'
WHERE slug = 'jeju-southern-unesco-geopark-day-tour';

-- 투어 비활성화
UPDATE tours 
SET is_active = false
WHERE slug = 'jeju-southern-unesco-geopark-day-tour';

-- 여러 필드 동시 수정
UPDATE tours 
SET 
  price = 85000,
  original_price = 100000,
  is_featured = true,
  description = '새로운 설명...'
WHERE slug = 'jeju-southern-unesco-geopark-day-tour';
```

---

## 방법 4: 제가 도와드리기

수정 요청을 주시면 제가 직접 파일을 수정해드릴 수 있습니다!

### 요청 형식

다음과 같이 요청해주세요:

```
"jeju-southern-unesco-geopark-day-tour 투어 수정해줘:
- 가격: 80000 → 85000으로 변경
- original_price: 100000으로 추가
- is_featured: true로 변경
"
```

또는:

```
"scripts/add-jeju-southern-unesco-geopark-tour.js 파일에서:
- price를 85000으로 변경
- description의 첫 문장 수정"
```

---

## 수정 가능한 필드 목록

### 기본 정보
- `title` - 투어 제목
- `slug` - URL slug (고유해야 함)
- `city` - 도시 ("Seoul", "Busan", "Jeju")
- `tag` - 태그
- `subtitle` - 부제목
- `description` - 설명

### 가격 정보
- `price` - 가격 (숫자)
- `original_price` - 원래 가격 (숫자, 선택)
- `price_type` - 가격 타입 ("person" 또는 "group")

### 이미지
- `image_url` - 메인 이미지 URL
- `gallery_images` - 갤러리 이미지 배열

### 투어 정보
- `duration` - 소요 시간 (예: "10 hours")
- `lunch_included` - 점심 포함 여부 (boolean)
- `ticket_included` - 티켓 포함 여부 (boolean)
- `pickup_info` - 픽업 정보 (텍스트)
- `notes` - 주의사항 (텍스트)

### 콘텐츠
- `highlights` - 하이라이트 배열
- `includes` - 포함 사항 배열
- `excludes` - 불포함 사항 배열
- `schedule` - 일정 배열
- `faqs` - FAQ 배열

### 상태
- `is_active` - 활성화 여부 (boolean)
- `is_featured` - 추천 여부 (boolean)
- `rating` - 평점 (숫자, 0-5)
- `review_count` - 리뷰 개수 (숫자)

---

## 픽업 포인트 수정

픽업 포인트는 투어와 별도로 관리됩니다. 수정하려면:

1. 기존 픽업 포인트 삭제 후 새로 추가
2. 또는 SQL로 직접 수정

```sql
-- 픽업 포인트 수정
UPDATE pickup_points 
SET name = '새 픽업 장소',
    address = '새 주소',
    lat = 33.4996,
    lng = 126.5312,
    pickup_time = '09:00:00'
WHERE tour_id = (SELECT id FROM tours WHERE slug = 'tour-slug')
  AND name = '기존 픽업 장소';
```

---

## 주의사항

### 1. slug 수정 시 주의

- slug는 고유해야 합니다
- slug를 변경하면 URL이 변경됩니다
- 기존 URL로 접근하면 404 에러 발생

### 2. 부분 수정 가능

- 수정할 필드만 포함하면 됩니다
- 나머지 필드는 그대로 유지됩니다

### 3. 권한 필요

- Admin 권한이 필요합니다
- `/admin`에서 로그인 후 실행

---

## 예시

### 예시 1: 가격만 수정

```javascript
const updateData = {
  price: 85000
};
```

### 예시 2: 여러 필드 동시 수정

```javascript
const updateData = {
  price: 85000,
  original_price: 100000,
  is_featured: true,
  description: '새로운 설명...'
};
```

### 예시 3: 배열 필드 수정

```javascript
const updateData = {
  highlights: [
    '하이라이트 1',
    '하이라이트 2',
    '새로운 하이라이트 3'
  ],
  includes: [
    '포함 항목 1',
    '포함 항목 2'
  ]
};
```

---

## 요약

✅ **가장 쉬운 방법**: `scripts/update-tour.js` 사용  
✅ **빠른 수정**: 위의 간단한 스크립트 사용  
✅ **대량 수정**: SQL 사용  
✅ **제가 도와드리기**: 요청하시면 파일 수정

어떤 방법을 선호하시나요? 특정 투어를 수정하고 싶으시면 알려주세요!











