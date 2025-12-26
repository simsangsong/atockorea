# 프로덕션 투어 404 문제 종합 분석

## 📋 문제 요약

**현상:** localhost:3000에서는 투어 상세 페이지가 정상 작동하지만, 프로덕션(atockorea.com)에서는 "Tour not found" 404 오류 발생

## ✅ 코드 리뷰 결과

### 1. API 라우트 구조
- ✅ `/app/api/tours/[id]/route.ts` - 올바른 구조
- ✅ UUID 및 slug 모두 지원
- ✅ `is_active=true` 필터 적용 (정상 동작)

### 2. 프론트엔드 라우팅
- ✅ `/app/tour/[id]/page.tsx` - 올바른 경로
- ✅ `window.location.origin` 사용 (프로덕션에서도 정상 작동)
- ✅ API 호출 방식 정상

### 3. 데이터 흐름
```
투어 목록 페이지 (/tours)
  ↓
/api/tours → 투어 배열 반환 (id: UUID)
  ↓
DetailedTourCard → /tour/${tour.id} 링크 생성
  ↓
투어 상세 페이지 (/tour/[id])
  ↓
/api/tours/[id] → 투어 상세 데이터 반환
```

**✅ 모든 단계에서 ID 형식 일관성 확인됨**

### 4. 에러 처리 개선사항

**추가된 기능:**
- ✅ Supabase 연결 실패 시 명확한 에러 메시지
- ✅ 환경 변수 누락 시 디버깅 정보 포함
- ✅ 투어가 비활성화된 경우 힌트 제공
- ✅ 상세한 로깅 (Vercel 로그에서 확인 가능)

## 🔍 가장 가능성 높은 원인

### 원인 1: 프로덕션 데이터베이스에 투어가 없음 (확률 70%)
**증상:**
- 로컬 DB에는 투어가 있음
- 프로덕션 DB에는 해당 투어가 없음

**확인 방법:**
```sql
-- Supabase Dashboard → SQL Editor
SELECT id, title, slug, is_active 
FROM tours 
WHERE id = 'd7691042-120b-4699-90b7-9cd0ac013898';
```

**해결 방법:**
- 프로덕션 DB에 투어 데이터 생성/마이그레이션
- 또는 로컬에서 투어를 프로덕션으로 복사

### 원인 2: is_active=false (확률 20%)
**증상:**
- 투어는 존재하지만 `is_active = false`
- API는 `is_active=true`만 반환

**확인 방법:**
```sql
SELECT id, title, is_active 
FROM tours 
WHERE id = 'd7691042-120b-4699-90b7-9cd0ac013898';
```

**해결 방법:**
```sql
UPDATE tours 
SET is_active = true 
WHERE id = 'd7691042-120b-4699-90b7-9cd0ac013898';
```

### 원인 3: 환경 변수 문제 (확률 10%)
**증상:**
- Supabase 연결 실패
- API가 500 에러 반환

**확인 방법:**
1. Vercel Dashboard → Settings → Environment Variables
2. 다음 변수 확인:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **가장 중요**

**해결 방법:**
- 환경 변수 값 확인 및 수정
- 재배포 (환경 변수 수정 후 필수)

## 🚀 즉시 확인해야 할 사항

### 우선순위 1: Vercel 로그 확인
1. Vercel Dashboard 접속
2. 프로젝트 선택
3. Deployments → 최신 배포
4. Functions 탭에서 다음 로그 검색:
   ```
   [API /tours/[id]]
   ```

**확인할 내용:**
- `Supabase client creation failed` → 환경 변수 문제
- `Tour not found (PGRST116)` → DB에 투어 없음
- `inactiveTour` → 투어는 있지만 비활성화
- `Debug info` → 전체 디버깅 정보

### 우선순위 2: 프로덕션 API 직접 테스트
```bash
node scripts/test-production-tour-api.js d7691042-120b-4699-90b7-9cd0ac013898
```

### 우선순위 3: 프로덕션 DB 확인
Supabase Dashboard → Table Editor → tours 테이블에서 해당 투어 ID 검색

## 🔧 해결 단계별 가이드

### Step 1: 원인 파악
1. ✅ Vercel 로그 확인 → 에러 타입 확인
2. ✅ 프로덕션 API 테스트 → HTTP 상태 코드 확인
3. ✅ 프로덕션 DB 확인 → 투어 존재 여부 확인

### Step 2: 문제 해결
- **투어 없음** → 프로덕션 DB에 투어 생성
- **is_active=false** → `UPDATE tours SET is_active = true`
- **환경 변수 문제** → Vercel에서 환경 변수 수정 후 재배포

### Step 3: 검증
1. 프로덕션 API 재테스트
2. 브라우저에서 투어 상세 페이지 접속
3. Vercel 로그에서 성공 메시지 확인

## 📝 체크리스트

진단:
- [ ] Vercel 로그 확인 완료
- [ ] 프로덕션 API 테스트 완료
- [ ] 프로덕션 DB에서 투어 확인 완료
- [ ] 환경 변수 확인 완료

해결:
- [ ] 문제 원인 파악 완료
- [ ] 해결 조치 실행 완료
- [ ] 프로덕션 재배포 완료 (필요 시)
- [ ] 검증 테스트 완료

## 📚 관련 문서

- `docs/PRODUCTION_TOUR_404_DEBUG.md` - 상세 디버깅 가이드
- `scripts/test-production-tour-api.js` - 프로덕션 API 테스트 스크립트
- `scripts/check-tour-in-production.js` - 로컬 DB 진단 스크립트

## 🎯 다음 단계

1. **즉시 실행:** Vercel 로그 확인
2. **원인 파악:** 로그 내용에 따라 위의 해결 방법 적용
3. **검증:** 문제 해결 후 프로덕션에서 테스트



