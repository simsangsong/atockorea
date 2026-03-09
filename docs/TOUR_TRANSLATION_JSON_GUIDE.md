# 투어 번역 JSON 가이드

투어 내용을 JSON으로 붙여넣으면, **각 언어(영/한/중 간체/중 번체/일/스페인어)로 SEO·원어민 느낌 번역** 후 `translations` JSON을 만들어 드립니다.  
이 문서는 **붙여넣을 JSON 형식**과 **적용 방법**을 정리합니다.

---

## 1. 지원 언어 (locale)

| 코드 | 언어 |
|------|------|
| `en` | English |
| `ko` | 한국어 |
| `zh` | 简体中文 |
| `zh-TW` | 繁體中文 |
| `ja` | 日本語 |
| `es` | Español |

---

## 2. 붙여넣을 JSON 형식 (원본 1개 언어)

아래 필드만 담은 **한 언어 버전** JSON을 그대로 붙여넣으면 됩니다.  
(원본이 한국어/영어 등 아무 언어여도 됩니다.)

```json
{
  "title": "투어 제목 (SEO·원어민에 맞게 번역할 문장)",
  "subtitle": "부제목 또는 한 줄 소개",
  "tag": "태그/카테고리 라벨",
  "description": "상세 설명 본문 (HTML 또는 긴 텍스트 가능)",
  "highlight": "한 줄 하이라이트 문구",
  "highlights": [
    "하이라이트 1",
    "하이라이트 2",
    "하이라이트 3"
  ],
  "includes": [
    "포함 항목 1",
    "포함 항목 2"
  ],
  "excludes": [
    "미포함 항목 1",
    "미포함 항목 2"
  ],
  "schedule": [
    {
      "time": "09:00",
      "title": "첫 번째 일정 제목",
      "description": "해당 시간대 설명"
    },
    {
      "time": "12:00",
      "title": "두 번째 일정 제목",
      "description": "해당 시간대 설명"
    }
  ],
  "pickup_info": "픽업 장소·시간 등 안내 문구",
  "notes": "유의사항·준비물 등",
  "faqs": [
    {
      "question": "자주 묻는 질문 1",
      "answer": "답변 1"
    },
    {
      "question": "자주 묻는 질문 2",
      "answer": "답변 2"
    }
  ]
}
```

- **필수:** `title`, `description` 정도만 있어도 됩니다.
- **선택:** 나머지는 있는 것만 넣으면 됩니다. 없으면 빈 배열 `[]` 또는 빈 문자열 `""`로 두어도 됩니다.
- `schedule`·`faqs`는 **객체 배열** 형태를 유지해 주세요.

---

## 3. 번역 후 받는 JSON 형식 (translations)

AI가 만들어 주는 결과는 **DB의 `translations` 컬럼에 그대로 넣을 수 있는 형태**입니다.

```json
{
  "en": {
    "title": "...",
    "subtitle": "...",
    "tag": "...",
    "description": "...",
    "highlight": "...",
    "highlights": [...],
    "includes": [...],
    "excludes": [...],
    "schedule": [...],
    "pickup_info": "...",
    "notes": "...",
    "faqs": [...]
  },
  "ko": { ... },
  "zh": { ... },
  "zh-TW": { ... },
  "ja": { ... },
  "es": { ... }
}
```

이 전체 객체를 그대로 **PATCH body의 `translations`** 에 넣으면 됩니다.

---

## 4. 적용 방법

### 방법 A: API로 직접 적용

1. 관리자로 로그인한 뒤 **Bearer 토큰**을 확보합니다.
2. 아래처럼 PATCH 요청을 보냅니다.

```http
PATCH /api/admin/tours/{tour_id}
Content-Type: application/json
Authorization: Bearer <your_admin_token>

{
  "translations": {
    "en": { ... },
    "ko": { ... },
    "zh": { ... },
    "zh-TW": { ... },
    "ja": { ... },
    "es": { ... }
  }
}
```

- `{tour_id}`: 수정할 투어의 UUID
- `translations`: 위 3번에서 받은 전체 객체

### 방법 B: 스크립트로 적용 (파일에서 읽기)

1. 번역 결과 JSON을 파일로 저장합니다.  
   예: `tour-translations.json` (최상위가 `translations` 객체와 동일한 구조)
2. 터미널에서:

```bash
# .env.local 에 ADMIN_TOKEN 또는 로그인 후 토큰 설정 후
node scripts/apply-tour-translations.js <tour_id> tour-translations.json
```

- `<tour_id>`: 적용할 투어 UUID
- `tour-translations.json`: 3번 형식의 JSON 파일 경로

스크립트는 **기존 `translations`와 머지**한 뒤 PATCH로 보냅니다.  
(특정 언어만 넣은 JSON이어도, 있는 locale만 덮어쓰고 나머지는 유지됩니다.)

---

## 5. 요약

1. **원본 투어 내용**을 위 2번 형식의 JSON으로 정리해 **한 번에 붙여넣기**  
2. AI가 **en, ko, zh, zh-TW, ja, es** 로 번역한 **`translations` 전체 JSON** 제공  
3. 그 JSON을 **방법 A(API)** 또는 **방법 B(스크립트)** 로 해당 투어에 적용  

API에서 일일이 넣지 않고, JSON 한 번 붙여넣고 → 번역 JSON 받아서 → 한 번에 적용하는 흐름입니다.
