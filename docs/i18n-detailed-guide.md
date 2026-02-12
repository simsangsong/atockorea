# 다국어 지원 구현 상세 가이드

## 📋 목차
1. [전체 아키텍처 개요](#전체-아키텍처-개요)
2. [데이터베이스 구조](#데이터베이스-구조)
3. [API 엔드포인트 구현](#api-엔드포인트-구현)
4. [프론트엔드 구현](#프론트엔드-구현)
5. [투어 생성 스크립트 수정](#투어-생성-스크립트-수정)
6. [실제 사용 예시](#실제-사용-예시)

---

## 전체 아키텍처 개요

### 데이터 흐름
```
사용자가 언어 변경
    ↓
I18nProvider가 locale 상태 업데이트
    ↓
프론트엔드 컴포넌트가 현재 locale 감지
    ↓
API 요청 시 locale 파라미터 포함
    ↓
API가 translations 필드에서 해당 언어 찾기
    ↓
번역된 데이터 반환
    ↓
프론트엔드에서 번역된 데이터 표시
```

### 지원 언어
- `en` - 영어 (기본 언어)
- `zh` - 중국어 간체
- `zh-TW` - 중국어 번체
- `ko` - 한국어
- `es` - 스페인어 (향후)
- `ja` - 일본어 (향후)

---

## 데이터베이스 구조

### 1. 기존 tours 테이블 구조
```sql
CREATE TABLE tours (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,              -- 영어 제목
  description TEXT,                  -- 영어 설명
  subtitle TEXT,                     -- 영어 부제목
  tag TEXT,                          -- 영어 태그
  -- ... 기타 필드들
);
```

### 2. translations 필드 추가
```sql
-- translations 필드를 JSONB 타입으로 추가
ALTER TABLE tours 
ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

-- GIN 인덱스 생성 (JSONB 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tours_translations 
ON tours USING GIN (translations);
```

### 3. translations 필드 구조
```json
{
  "zh": {
    "title": "中文标题",
    "description": "中文描述",
    "subtitle": "中文副标题",
    "tag": "中文标签",
    "highlights": ["亮点1", "亮点2", "亮点3"],
    "includes": ["包含1", "包含2"],
    "excludes": ["不包含1", "不包含2"],
    "schedule": [
      {
        "time": "09:00",
        "title": "中文标题",
        "description": "中文描述"
      }
    ],
    "faqs": [
      {
        "question": "中文问题",
        "answer": "中文答案"
      }
    ],
    "pickup_info": "中文接车信息",
    "notes": "中文注意事项"
  },
  "zh-TW": {
    "title": "繁體中文標題",
    "description": "繁體中文描述",
    // ... 동일한 구조
  },
  "ko": {
    "title": "한국어 제목",
    "description": "한국어 설명",
    // ... 동일한 구조
  }
}
```

### 4. 데이터베이스 업데이트 방법

**Supabase 대시보드에서:**
1. SQL Editor 열기
2. 다음 SQL 실행:
```sql
ALTER TABLE tours 
ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tours_translations 
ON tours USING GIN (translations);
```

**또는 터미널에서:**
```bash
# supabase/add-translations-to-tours.sql 파일 실행
psql -h [host] -U [user] -d [database] -f supabase/add-translations-to-tours.sql
```

---

## API 엔드포인트 구현

### 1. 투어 목록 API (`/api/tours`)

**파일 위치:** `app/api/tours/route.ts`

**주요 기능:**
- `locale` 쿼리 파라미터 받기
- `translations` 필드에서 해당 언어 찾기
- 번역이 없으면 기본 언어(영어) 사용

**코드 구조:**
```typescript
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get('locale') || 'en'; // locale 파라미터 추출
  
  // 투어 목록 조회
  const { data: tours, error } = await query;
  
  // 각 투어에 번역 적용
  const translatedTours = tours.map((tour) => {
    const translations = tour.translations || {};
    const localeTranslations = translations[locale] || 
                               translations[locale.split('-')[0]] || 
                               {}; // zh-TW → zh 폴백
    
    return {
      ...tour,
      title: localeTranslations.title || tour.title,
      description: localeTranslations.description || tour.description,
      // ... 기타 필드들
    };
  });
  
  return NextResponse.json({ tours: translatedTours });
}
```

**동작 방식:**
1. `locale` 파라미터가 없으면 기본값 `'en'` 사용
2. `translations[locale]`에서 번역 찾기
3. 없으면 `translations[locale.split('-')[0]]`로 폴백 (예: `zh-TW` → `zh`)
4. 그래도 없으면 기본 필드 사용 (영어)

**요청 예시:**
```javascript
// 영어 (기본)
GET /api/tours

// 중국어 간체
GET /api/tours?locale=zh

// 중국어 번체
GET /api/tours?locale=zh-TW

// 한국어
GET /api/tours?locale=ko
```

### 2. 투어 상세 API (`/api/tours/[id]`)

**파일 위치:** `app/api/tours/[id]/route.ts`

**주요 기능:**
- ID 또는 slug로 투어 조회
- `locale` 쿼리 파라미터로 번역 적용
- 단일 투어 반환

**코드 구조:**
```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tourIdOrSlug = params.id;
  const locale = searchParams.get('locale') || 'en';
  
  // UUID인지 slug인지 확인
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(tourIdOrSlug);
  
  let query = supabase.from('tours').select('*');
  
  if (isUUID) {
    query = query.eq('id', tourIdOrSlug);
  } else {
    query = query.eq('slug', tourIdOrSlug);
  }
  
  const { data: tour, error } = await query.single();
  
  // 번역 적용
  const translations = tour.translations || {};
  const localeTranslations = translations[locale] || 
                             translations[locale.split('-')[0]] || 
                             {};
  
  const translatedTour = {
    ...tour,
    title: localeTranslations.title || tour.title,
    description: localeTranslations.description || tour.description,
    // ... 기타 필드들
  };
  
  return NextResponse.json({ tour: translatedTour });
}
```

**요청 예시:**
```javascript
// UUID로 조회
GET /api/tours/123e4567-e89b-12d3-a456-426614174000?locale=zh

// slug로 조회
GET /api/tours/seoul-full-day-tour?locale=zh
```

---

## 프론트엔드 구현

### 1. I18n 시스템 (`lib/i18n.ts`)

**주요 기능:**
- 현재 locale 상태 관리
- localStorage에 locale 저장
- 번역 함수 제공

**사용 방법:**
```typescript
import { useI18n, useTranslations } from '@/lib/i18n';

function MyComponent() {
  const { locale, setLocale } = useI18n(); // 현재 locale 가져오기
  const t = useTranslations(); // 번역 함수
  
  // locale 변경
  setLocale('zh');
  
  // 번역 사용
  return <div>{t('tour.title')}</div>;
}
```

### 2. 투어 목록 페이지 (`app/tours/page.tsx`)

**변경 사항:**
```typescript
import { useI18n } from '@/lib/i18n';

function ToursContent() {
  const { locale } = useI18n(); // 현재 locale 가져오기
  
  const fetchTours = async () => {
    const params = new URLSearchParams();
    params.append('locale', locale); // locale 파라미터 추가
    
    const response = await fetch(`/api/tours?${params.toString()}`);
    // ...
  };
}
```

**동작 흐름:**
1. 사용자가 언어 변경
2. `I18nProvider`가 `locale` 상태 업데이트
3. `useI18n()` 훅이 새로운 `locale` 반환
4. `fetchTours` 함수가 자동으로 재실행 (useEffect 의존성)
5. API 요청에 `locale` 파라미터 포함
6. 번역된 투어 목록 표시

### 3. 투어 상세 페이지 (`app/tour/[id]/page.tsx`)

**변경 사항:**
```typescript
import { useI18n } from '@/lib/i18n';

export default function TourDetailPage() {
  const { locale } = useI18n();
  const [tour, setTour] = useState(null);
  
  useEffect(() => {
    const fetchTour = async () => {
      // locale 파라미터 포함
      const response = await fetch(`/api/tours/${tourId}?locale=${locale}`);
      const data = await response.json();
      setTour(data.tour);
    };
    
    fetchTour();
  }, [tourId, locale]); // locale 변경 시 재요청
}
```

**동작 흐름:**
1. 페이지 로드 시 현재 locale로 API 요청
2. 사용자가 언어 변경
3. `locale` 변경 감지 (useEffect 의존성)
4. API 재요청 (새로운 locale로)
5. 번역된 투어 데이터 표시

### 4. 투어 카드 컴포넌트 (`components/TourCard.tsx`)

**자동 번역:**
- 투어 카드는 API에서 받은 데이터를 그대로 표시
- API가 이미 번역된 데이터를 반환하므로 추가 작업 불필요
- `tour.title`, `tour.description` 등이 이미 번역된 상태

---

## 투어 생성 스크립트 수정

### 1. 기존 스크립트 구조

**현재 구조:**
```javascript
const tourData = {
  title: "English Title",
  description: "English description...",
  // ... 기타 필드들
};
```

### 2. 다국어 필드 추가

**수정된 구조:**
```javascript
const tourData = {
  // ===== 기본 필드 (영어) =====
  title: "Seoul: Full-Day Private Car Charter Service",
  description: "English description...",
  subtitle: "Top rated",
  tag: "Seoul · Private Tour",
  
  // ===== 다국어 번역 =====
  translations: {
    zh: {
      title: "首尔：全天私人包车服务",
      description: "中文描述...",
      subtitle: "高评分",
      tag: "首尔 · 私人游",
      highlights: [
        "亮点1",
        "亮点2",
        "亮点3"
      ],
      includes: [
        "包含1",
        "包含2"
      ],
      excludes: [
        "不包含1",
        "不包含2"
      ],
      schedule: [
        {
          time: "09:00",
          title: "中文标题",
          description: "中文描述"
        }
      ],
      faqs: [
        {
          question: "中文问题",
          answer: "中文答案"
        }
      ],
      pickup_info: "中文接车信息",
      notes: "中文注意事项"
    },
    "zh-TW": {
      title: "首爾：全天私人包車服務",
      description: "繁體中文描述...",
      // ... 동일한 구조
    },
    ko: {
      title: "서울: 종일 프라이빗 차량 대여 서비스",
      description: "한국어 설명...",
      // ... 동일한 구조
    }
  }
};
```

### 3. 실제 스크립트 예시

**완전한 예시:**
```javascript
const tourData = {
  // 필수 필드
  title: "Busan: Top Attractions Authentic One-Day Guided Tour",
  slug: `busan-top-attractions-${Date.now()}`,
  city: "Busan",
  price: 50000,
  price_type: "person",
  image_url: "https://...",
  
  // 기본 필드 (영어)
  tag: "Busan · Day tour",
  subtitle: "Authentic experience",
  description: "Explore Busan's top attractions...",
  duration: "09:00–17:00 · 8 hours",
  
  highlights: [
    "Visit Gamcheon Culture Village",
    "Relax at Haeundae Beach",
    // ...
  ],
  
  includes: [
    "Professional guide",
    "Hotel pickup",
    // ...
  ],
  
  excludes: [
    "Lunch",
    "Personal expenses",
    // ...
  ],
  
  schedule: [
    {
      time: "09:00",
      title: "Hotel Pickup",
      description: "Pickup from your hotel"
    },
    // ...
  ],
  
  faqs: [
    {
      question: "What is included?",
      answer: "Professional guide and transportation..."
    },
    // ...
  ],
  
  pickup_info: "Pickup available from hotels in Busan...",
  notes: "Please arrive 10 minutes before pickup time...",
  
  // ===== 다국어 번역 =====
  translations: {
    zh: {
      title: "釜山：热门景点正宗一日游",
      tag: "釜山 · 一日游",
      subtitle: "正宗体验",
      description: "探索釜山的热门景点...",
      highlights: [
        "参观甘川文化村",
        "在海云台海滩放松",
        // ...
      ],
      includes: [
        "专业导游",
        "酒店接送",
        // ...
      ],
      excludes: [
        "午餐",
        "个人消费",
        // ...
      ],
      schedule: [
        {
          time: "09:00",
          title: "酒店接送",
          description: "从您的酒店接您"
        },
        // ...
      ],
      faqs: [
        {
          question: "包含什么？",
          answer: "专业导游和交通..."
        },
        // ...
      ],
      pickup_info: "可从釜山的酒店接送...",
      notes: "请在接送时间前10分钟到达..."
    },
    "zh-TW": {
      title: "釜山：熱門景點正宗一日遊",
      // ... 동일한 구조
    },
    ko: {
      title: "부산: 인기 명소 정통 일일 투어",
      // ... 동일한 구조
    }
  }
};
```

### 4. 스크립트 실행 후 확인

**콘솔에서 확인:**
```javascript
// 투어 생성 후
console.log('Tour created:', response);

// translations 필드 확인
const tour = await fetch(`/api/tours/${tourId}`).then(r => r.json());
console.log('Translations:', tour.tour.translations);
```

---

## 실제 사용 예시

### 시나리오 1: 사용자가 언어 변경

1. **초기 상태 (영어)**
   - 사용자가 홈페이지 접속
   - 기본 언어: 영어
   - API 요청: `GET /api/tours?locale=en`
   - 표시: 영어 투어 목록

2. **언어 변경 (중국어)**
   - 사용자가 언어 선택기에서 "中文 (繁體)" 선택
   - `I18nProvider`가 `locale`을 `'zh-TW'`로 업데이트
   - localStorage에 저장
   - 모든 API 요청에 `locale=zh-TW` 자동 포함

3. **투어 목록 업데이트**
   - `app/tours/page.tsx`의 `useEffect`가 `locale` 변경 감지
   - `fetchTours()` 함수 재실행
   - API 요청: `GET /api/tours?locale=zh-TW`
   - API가 `translations.zh-TW`에서 번역 찾기
   - 번역된 투어 목록 표시

4. **투어 상세 페이지**
   - 투어 카드 클릭
   - `/tour/[id]` 페이지로 이동
   - API 요청: `GET /api/tours/[id]?locale=zh-TW`
   - 번역된 투어 상세 정보 표시

### 시나리오 2: 번역이 없는 경우

1. **폴백 메커니즘**
   ```typescript
   // API에서
   const localeTranslations = 
     translations['zh-TW'] ||      // 1순위: 정확한 locale
     translations['zh'] ||          // 2순위: 언어 코드만 (zh-TW → zh)
     {};                            // 3순위: 빈 객체
   
   // 최종 값
   title: localeTranslations.title || tour.title; // 4순위: 기본 필드
   ```

2. **예시**
   - 사용자 언어: `zh-TW`
   - `translations.zh-TW` 없음
   - `translations.zh` 있음 → 사용
   - 둘 다 없음 → 영어 필드 사용

### 시나리오 3: 기존 투어에 번역 추가

**Supabase 대시보드에서:**
```sql
UPDATE tours
SET translations = jsonb_set(
  COALESCE(translations, '{}'::jsonb),
  '{zh}',
  '{
    "title": "釜山：热门景点正宗一日游",
    "description": "中文描述...",
    "tag": "釜山 · 一日游"
  }'::jsonb
)
WHERE slug = 'busan-top-attractions-...';
```

**또는 API를 통해:**
```javascript
// PATCH /api/admin/tours/[id]
const response = await fetch(`/api/admin/tours/${tourId}`, {
  method: 'PATCH',
  body: JSON.stringify({
    translations: {
      zh: {
        title: "釜山：热门景点正宗一日游",
        // ...
      }
    }
  })
});
```

---

## 디버깅 및 확인 방법

### 1. 현재 locale 확인
```javascript
// 브라우저 콘솔에서
const { locale } = useI18n();
console.log('Current locale:', locale);
```

### 2. API 응답 확인
```javascript
// Network 탭에서
// GET /api/tours?locale=zh 응답 확인
// translations 필드 확인
```

### 3. 데이터베이스 확인
```sql
-- Supabase SQL Editor에서
SELECT 
  id,
  title,
  translations->'zh'->>'title' as chinese_title,
  translations->'ko'->>'title' as korean_title
FROM tours
WHERE id = '...';
```

### 4. 번역 필드 구조 확인
```javascript
// 브라우저 콘솔에서
const tour = await fetch('/api/tours/[id]?locale=zh')
  .then(r => r.json());
console.log('Tour translations:', tour.tour.translations);
console.log('Displayed title:', tour.tour.title);
```

---

## 주의사항 및 베스트 프랙티스

### 1. 번역 필수 항목
- `title`: 필수 (가장 중요)
- `description`: 권장
- `tag`: 권장
- 나머지: 선택

### 2. 번역 품질
- 전문 번역가 사용 권장
- 기계 번역은 검토 후 사용
- 문화적 맥락 고려

### 3. 성능 최적화
- `translations` 필드는 JSONB로 인덱싱됨
- 필요한 언어만 번역 (전체 번역 불필요)
- 폴백 메커니즘으로 기본 언어 사용

### 4. 유지보수
- 새로운 언어 추가 시 `translations` 구조 유지
- 번역 업데이트는 기존 투어에도 적용
- 번역 누락 시 기본 언어로 표시

---

## 다음 단계

1. ✅ 데이터베이스에 `translations` 필드 추가
2. ✅ API 엔드포인트 구현 완료
3. ✅ 프론트엔드 구현 완료
4. ⏳ 기존 투어에 번역 추가
5. ⏳ 새로운 투어 생성 시 번역 포함
6. ⏳ 번역 품질 검토 및 개선

---

## 참고 자료

- [Supabase JSONB 문서](https://supabase.com/docs/guides/database/extensions/postgres-json)
- [Next.js i18n 가이드](https://nextjs.org/docs/advanced-features/i18n-routing)
- [React Context API](https://react.dev/reference/react/createContext)




