# 다국어 지원 구현 가이드

## 개요
투어 카드와 투어 상세 페이지가 사용자가 선택한 언어에 따라 자동으로 번역되도록 구현되었습니다.

## 구현 단계

### 1. 데이터베이스 스키마 업데이트
```sql
-- supabase/add-translations-to-tours.sql 실행
ALTER TABLE tours 
ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;
```

### 2. API 엔드포인트
- **GET /api/tours** - 투어 목록 (locale 파라미터 지원)
- **GET /api/tours/[id]** - 투어 상세 (locale 파라미터 지원)

API는 `locale` 쿼리 파라미터를 받아서 해당 언어의 번역을 반환합니다.

### 3. 프론트엔드
- 투어 목록 페이지 (`app/tours/page.tsx`)는 현재 locale을 API 요청에 포함합니다.
- 투어 상세 페이지 (`app/tour/[id]/page.tsx`)는 API에서 데이터를 가져와 locale에 맞는 번역을 표시합니다.

## 투어 생성 시 다국어 필드 추가 방법

### translations 필드 구조
```json
{
  "zh": {
    "title": "中文标题",
    "description": "中文描述",
    "subtitle": "中文副标题",
    "tag": "中文标签",
    "highlights": ["亮点1", "亮点2"],
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
    ...
  },
  "ko": {
    "title": "한국어 제목",
    ...
  }
}
```

### 투어 생성 스크립트 예시
```javascript
const tourData = {
  title: "English Title", // 기본 언어 (영어)
  // ... 기타 필드들
  translations: {
    zh: {
      title: "中文标题",
      description: "中文描述",
      // ...
    },
    "zh-TW": {
      title: "繁體中文標題",
      // ...
    },
    ko: {
      title: "한국어 제목",
      // ...
    }
  }
};
```

## 지원 언어
- `en` - 영어 (기본)
- `zh` - 중국어 (간체)
- `zh-TW` - 중국어 (번체)
- `ko` - 한국어

## 동작 방식
1. 사용자가 언어를 변경하면 `useI18n()` 훅이 현재 locale을 반환합니다.
2. API 요청 시 `locale` 파라미터가 자동으로 포함됩니다.
3. API는 `translations` 필드에서 해당 locale의 번역을 찾아 반환합니다.
4. 번역이 없으면 기본 언어(영어) 필드를 사용합니다.

## 다음 단계
1. 데이터베이스에 `translations` 필드 추가 (SQL 스크립트 실행)
2. 기존 투어에 다국어 번역 추가
3. 새로운 투어 생성 시 다국어 필드 포함




