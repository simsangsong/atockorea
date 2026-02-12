# 기존 투어에 다국어 번역 추가 가이드

## 개요
이미 생성된 투어들에 다국어 번역을 추가하는 방법을 안내합니다.

## 방법 1: F12 콘솔 스크립트 사용 (권장)

### 단계별 가이드

1. **투어 ID 확인**
   - 브라우저 콘솔에서:
   ```javascript
   // 투어 목록 가져오기
   fetch('/api/tours').then(r => r.json()).then(data => {
     console.table(data.tours.map(t => ({
       id: t.id,
       title: t.title,
       slug: t.slug
     })));
   });
   ```

2. **스크립트 실행**
   - `/admin`에서 로그인
   - F12 콘솔 열기
   - `scripts/update-tour-translations.js` 파일 열기
   - `tourId` 변수에 실제 투어 ID 입력
   - 번역 데이터 수정 (필요시)
   - 스크립트 전체 복사 후 콘솔에 붙여넣기

3. **결과 확인**
   ```javascript
   // 업데이트 확인
   fetch('/api/tours/YOUR_TOUR_ID?locale=zh').then(r => r.json())
     .then(data => console.log('중국어 제목:', data.tour.title));
   ```

## 방법 2: Supabase 대시보드에서 직접 수정

### 단계별 가이드

1. **Supabase 대시보드 접속**
   - https://supabase.com/dashboard 접속
   - 프로젝트 선택

2. **Table Editor 열기**
   - 왼쪽 메뉴에서 "Table Editor" 클릭
   - `tours` 테이블 선택

3. **투어 찾기**
   - 검색 또는 필터로 원하는 투어 찾기
   - 투어 행 클릭하여 편집 모드 진입

4. **translations 필드 수정**
   - `translations` 컬럼 클릭
   - JSON 형식으로 번역 입력:
   ```json
   {
     "zh": {
       "title": "釜山：热门景点正宗一日游",
       "description": "中文描述...",
       "tag": "釜山 · 一日游"
     },
     "zh-TW": {
       "title": "釜山：熱門景點正宗一日遊",
       "description": "繁體中文描述...",
       "tag": "釜山 · 一日遊"
     },
     "ko": {
       "title": "부산: 인기 명소 정통 일일 투어",
       "description": "한국어 설명...",
       "tag": "부산 · 일일 투어"
     }
   }
   ```

5. **저장**
   - "Save" 버튼 클릭

## 방법 3: SQL 쿼리 사용

### Supabase SQL Editor에서 실행

```sql
-- 특정 투어에 번역 추가
UPDATE tours
SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb),
  '{zh}',
  '{
    "title": "釜山：热门景点正宗一日游",
    "description": "中文描述...",
    "tag": "釜山 · 一日游",
    "subtitle": "正宗体验",
    "highlights": ["亮点1", "亮点2"],
    "includes": ["包含1", "包含2"],
    "excludes": ["不包含1", "不包含2"],
    "schedule": [
      {
        "time": "09:00",
        "title": "酒店接送",
        "description": "从您的酒店接您"
      }
    ],
    "faqs": [
      {
        "question": "包含什么？",
        "answer": "专业导游和交通..."
      }
    ],
    "pickup_info": "中文接车信息",
    "notes": "中文注意事项"
  }'::jsonb
)
WHERE id = 'YOUR_TOUR_ID_HERE';

-- 여러 언어 한번에 추가
UPDATE tours
SET translations = '{
  "zh": {
    "title": "釜山：热门景点正宗一日游",
    "description": "中文描述...",
    "tag": "釜山 · 一日游"
  },
  "zh-TW": {
    "title": "釜山：熱門景點正宗一日遊",
    "description": "繁體中文描述...",
    "tag": "釜山 · 一日遊"
  },
  "ko": {
    "title": "부산: 인기 명소 정통 일일 투어",
    "description": "한국어 설명...",
    "tag": "부산 · 일일 투어"
  }
}'::jsonb
WHERE id = 'YOUR_TOUR_ID_HERE';

-- 기존 번역에 새 언어 추가 (기존 번역 유지)
UPDATE tours
SET translations = jsonb_set(
  translations,
  '{ko}',
  '{
    "title": "부산: 인기 명소 정통 일일 투어",
    "description": "한국어 설명..."
  }'::jsonb
)
WHERE id = 'YOUR_TOUR_ID_HERE'
AND translations IS NOT NULL;
```

## 방법 4: API를 통한 업데이트

### PATCH 엔드포인트 사용

```javascript
// 브라우저 콘솔에서 (admin 로그인 필요)
const token = 'YOUR_AUTH_TOKEN';

const response = await fetch('/api/admin/tours/YOUR_TOUR_ID', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    translations: {
      zh: {
        title: "釜山：热门景点正宗一日游",
        description: "中文描述...",
        // ... 기타 필드
      },
      "zh-TW": {
        title: "釜山：熱門景點正宗一日遊",
        // ...
      },
      ko: {
        title: "부산: 인기 명소 정통 일일 투어",
        // ...
      }
    }
  })
});

const result = await response.json();
console.log('업데이트 결과:', result);
```

## 기존 투어 번역 예시

### 부산 투어 1: Top Attractions Tour

```json
{
  "zh": {
    "title": "釜山：热门景点正宗一日游",
    "tag": "釜山 · 一日游",
    "subtitle": "正宗体验",
    "description": "探索釜山的热门景点，体验正宗的韩国文化..."
  },
  "zh-TW": {
    "title": "釜山：熱門景點正宗一日遊",
    "tag": "釜山 · 一日遊",
    "subtitle": "正宗體驗",
    "description": "探索釜山的熱門景點，體驗正宗的韓國文化..."
  },
  "ko": {
    "title": "부산: 인기 명소 정통 일일 투어",
    "tag": "부산 · 일일 투어",
    "subtitle": "정통 경험",
    "description": "부산의 인기 명소를 탐험하고 정통 한국 문화를 경험하세요..."
  }
}
```

### 부산 투어 2: Private Tour

```json
{
  "zh": {
    "title": "釜山私人游 - 与当地导游一起探索热门景点",
    "tag": "釜山 · 私人游",
    "subtitle": "高评分",
    "description": "与经验丰富的当地导游一起探索釜山的最佳景点..."
  },
  "zh-TW": {
    "title": "釜山私人遊 - 與當地導遊一起探索熱門景點",
    "tag": "釜山 · 私人遊",
    "subtitle": "高評分",
    "description": "與經驗豐富的當地導遊一起探索釜山的最佳景點..."
  },
  "ko": {
    "title": "부산 프라이빗 투어 - 현지 가이드와 함께 인기 명소 탐험",
    "tag": "부산 · 프라이빗 투어",
    "subtitle": "최고 평점",
    "description": "경험이 풍부한 현지 가이드와 함께 부산의 최고 명소를 탐험하세요..."
  }
}
```

### 서울 투어: Private Car Charter

```json
{
  "zh": {
    "title": "首尔：全天私人包车服务",
    "tag": "首尔 · 私人游",
    "subtitle": "高评分",
    "description": "按照自己的节奏探索首尔或江原道，享受全天或半天的私人包车服务..."
  },
  "zh-TW": {
    "title": "首爾：全天私人包車服務",
    "tag": "首爾 · 私人遊",
    "subtitle": "高評分",
    "description": "按照自己的節奏探索首爾或江原道，享受全天或半天的私人包車服務..."
  },
  "ko": {
    "title": "서울: 종일 프라이빗 차량 대여 서비스",
    "tag": "서울 · 프라이빗 투어",
    "subtitle": "최고 평점",
    "description": "전용 운전사와 함께 서울 또는 강원도를 자유롭게 탐험하는 종일 또는 반일 프라이빗 투어입니다..."
  }
}
```

## 번역 확인 방법

### 1. 브라우저에서 확인
```javascript
// 중국어로 확인
fetch('/api/tours/YOUR_TOUR_ID?locale=zh')
  .then(r => r.json())
  .then(data => console.log('중국어:', data.tour.title));

// 한국어로 확인
fetch('/api/tours/YOUR_TOUR_ID?locale=ko')
  .then(r => r.json())
  .then(data => console.log('한국어:', data.tour.title));
```

### 2. 웹사이트에서 확인
1. 언어 선택기를 "中文 (繁體)"로 변경
2. 투어 목록 페이지에서 중국어로 표시되는지 확인
3. 투어 상세 페이지에서도 중국어로 표시되는지 확인

### 3. SQL로 확인
```sql
SELECT 
  id,
  title as english_title,
  translations->'zh'->>'title' as chinese_title,
  translations->'ko'->>'title' as korean_title
FROM tours
WHERE id = 'YOUR_TOUR_ID';
```

## 주의사항

1. **기존 번역 보존**
   - 기존 번역이 있는 경우 덮어쓰지 않도록 주의
   - `jsonb_set`을 사용하여 특정 언어만 업데이트

2. **JSON 형식**
   - JSON 형식이 올바른지 확인
   - 따옴표 이스케이프 주의

3. **필수 필드**
   - 최소한 `title`은 번역하는 것을 권장
   - 다른 필드는 선택사항

4. **테스트**
   - 번역 추가 후 반드시 웹사이트에서 확인
   - 모든 언어로 테스트

## 빠른 시작 스크립트

기존 투어 3개에 빠르게 번역을 추가하려면:

```javascript
// scripts/update-all-tours-translations.js
// 모든 기존 투어에 번역 추가 (투어 ID를 실제 값으로 변경)

const toursToUpdate = [
  {
    id: 'TOUR_ID_1', // 부산 Top Attractions Tour
    translations: { /* 번역 데이터 */ }
  },
  {
    id: 'TOUR_ID_2', // 부산 Private Tour
    translations: { /* 번역 데이터 */ }
  },
  {
    id: 'TOUR_ID_3', // 서울 Private Car Charter
    translations: { /* 번역 데이터 */ }
  }
];

// 각 투어 업데이트
toursToUpdate.forEach(async (tour) => {
  await fetch(`/api/admin/tours/${tour.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      translations: tour.translations
    })
  });
});
```

## 도움이 필요하신가요?

- 번역이 제대로 표시되지 않으면 브라우저 콘솔 확인
- API 오류가 발생하면 네트워크 탭에서 응답 확인
- 데이터베이스 오류는 Supabase 로그 확인




