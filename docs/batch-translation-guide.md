# 일괄 번역 가이드

## 개요
기존 투어들에 번역을 하나하나 수동으로 추가하는 대신, 일괄 처리하는 방법을 제공합니다.

## 방법 1: 기본 번역 자동 생성 (무료, 빠름)

### 특징
- ✅ 무료
- ✅ 빠름 (즉시 실행)
- ✅ 키워드 기반 번역
- ⚠️ 정확도 낮음 (간단한 키워드 교체)

### 사용 방법

1. **스크립트 실행**
   ```javascript
   // scripts/batch-update-tours-translations.js 파일 열기
   // 전체 복사 후 브라우저 콘솔에 붙여넣기
   ```

2. **결과 확인**
   - 모든 투어에 기본 번역이 자동으로 추가됩니다
   - 제목, 태그 등이 키워드 기반으로 번역됩니다

3. **수동 보정**
   - 생성된 번역을 확인하고 필요한 부분만 수정
   - Supabase 대시보드 또는 API로 개별 수정

### 예시
```
영어: "Busan: Top Attractions Authentic One-Day Guided Tour"
→ 중국어: "釜山：热门景点正宗一日游"
→ 한국어: "부산: 인기 명소 정통 일일 투어"
```

## 방법 2: Google Translate API 사용 (유료, 정확)

### 특징
- ✅ 높은 정확도
- ✅ 모든 필드 자동 번역
- ⚠️ Google Cloud API 키 필요
- ⚠️ 비용 발생 (무료 할당량 있음)

### 설정 방법

1. **Google Cloud Console 설정**
   - https://console.cloud.google.com 접속
   - 새 프로젝트 생성 또는 기존 프로젝트 선택
   - "API 및 서비스" > "라이브러리" 이동
   - "Cloud Translation API" 검색 후 활성화
   - "사용자 인증 정보" > "API 키 만들기"

2. **스크립트 수정**
   ```javascript
   // scripts/auto-translate-tours.js 파일 열기
   const GOOGLE_TRANSLATE_API_KEY = 'YOUR_API_KEY_HERE';
   // ↑ 여기에 API 키 입력
   ```

3. **스크립트 실행**
   - 브라우저 콘솔에 붙여넣기
   - 모든 투어가 자동으로 번역됩니다

### 비용
- 무료 할당량: 월 500,000자
- 초과 시: $20 / 1,000,000자

## 방법 3: 하이브리드 방식 (권장)

### 단계별 가이드

1. **1단계: 기본 번역 생성**
   ```javascript
   // batch-update-tours-translations.js 실행
   // 모든 투어에 기본 번역 추가
   ```

2. **2단계: 중요 필드만 정확히 번역**
   - 제목, 설명 등 중요 필드만 Google Translate API 사용
   - 또는 전문 번역가에게 의뢰

3. **3단계: 수동 검토 및 수정**
   - 생성된 번역 검토
   - 문화적 맥락 고려하여 수정

## 방법 4: CSV 파일로 일괄 업로드

### 준비

1. **CSV 파일 생성**
   ```csv
   tour_id,language,field,value
   uuid-1,zh,title,釜山：热门景点正宗一日游
   uuid-1,zh,description,中文描述...
   uuid-1,ko,title,부산: 인기 명소 정통 일일 투어
   uuid-1,ko,description,한국어 설명...
   ```

2. **업로드 스크립트 실행**
   ```javascript
   // CSV 파일 읽기 및 업로드
   // (별도 스크립트 필요)
   ```

## 추천 워크플로우

### 빠른 시작 (1시간 이내)
1. `batch-update-tours-translations.js` 실행
2. 웹사이트에서 확인
3. 중요한 투어만 수동 수정

### 완벽한 번역 (1-2일)
1. `batch-update-tours-translations.js` 실행 (기본 번역)
2. Google Translate API로 중요 필드 재번역
3. 전문 번역가 검토 (선택)
4. 최종 수정

## 스크립트 비교

| 스크립트 | 비용 | 속도 | 정확도 | 사용 시기 |
|---------|------|------|--------|----------|
| batch-update-tours-translations.js | 무료 | 빠름 | 낮음 | 빠른 프로토타입 |
| auto-translate-tours.js | 유료 | 보통 | 높음 | 프로덕션 준비 |

## 주의사항

1. **API 키 보안**
   - Google Translate API 키는 절대 공개하지 마세요
   - 프로덕션에서는 서버 사이드에서 처리

2. **번역 품질**
   - 자동 번역은 100% 정확하지 않습니다
   - 중요한 콘텐츠는 반드시 검토하세요

3. **비용 관리**
   - Google Translate API 사용량 모니터링
   - 무료 할당량 초과 주의

## 다음 단계

1. ✅ 기본 번역 스크립트 실행
2. ⏳ 번역 품질 확인
3. ⏳ 필요한 부분만 수동 수정
4. ⏳ 웹사이트에서 최종 확인




