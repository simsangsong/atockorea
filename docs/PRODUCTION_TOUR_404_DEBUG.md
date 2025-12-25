# 프로덕션 투어 404 오류 디버깅 가이드

## 🚨 문제 현상

- ✅ 로컬(localhost:3000)에서는 투어 상세 페이지가 정상 작동
- ❌ 프로덕션(atockorea.com)에서는 "Tour not found" 404 오류 발생

## 🔍 체계적 진단 방법

### 1. 프로덕션 API 직접 테스트

```bash
# 스크립트 실행
node scripts/test-production-tour-api.js d7691042-120b-4699-90b7-9cd0ac013898

# 또는 curl 사용
curl -v https://www.atockorea.com/api/tours/d7691042-120b-4699-90b7-9cd0ac013898
```

**확인 사항:**
- HTTP 상태 코드 (200 vs 404 vs 500)
- 응답 본문의 에러 메시지
- 에러 코드 (`NOT_FOUND`, `SUPABASE_CONNECTION_ERROR` 등)

### 2. Vercel 환경 변수 확인

**Vercel Dashboard → 프로젝트 → Settings → Environment Variables**

필수 환경 변수:
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - Supabase 프로젝트 URL
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anon Key (클라이언트용)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Supabase Service Role Key (서버용, **가장 중요**)

**⚠️ 중요:**
- 환경 변수가 **Production**, **Preview**, **Development** 모두에 설정되어 있는지 확인
- 값이 올바른지 확인 (로컬 `.env.local`과 비교)
- 환경 변수 수정 후 **반드시 재배포** 필요

### 3. Vercel 로그 확인

**Vercel Dashboard → 프로젝트 → Deployments → 최신 배포 → Functions 탭**

**확인할 로그:**
```
[API /tours/[id]] Fetching tour: { tourId: '...', url: '...' }
[API /tours/[id]] Query params: { ... }
[API /tours/[id]] Tour fetch error: { ... }
[API /tours/[id]] Debug info: { ... }
```

**특히 확인:**
- `SUPABASE_CONNECTION_ERROR` - 환경 변수 문제
- `PGRST116` - 투어가 DB에 없음
- `inactiveTour` - 투어가 있지만 `is_active=false`
- `allToursCount` - DB에 총 몇 개의 투어가 있는지

### 4. 프로덕션 데이터베이스 확인

**Supabase Dashboard → Table Editor → tours**

해당 투어 ID로 검색:
```sql
SELECT id, title, slug, city, is_active, created_at 
FROM tours 
WHERE id = 'd7691042-120b-4699-90b7-9cd0ac013898';
```

**확인 사항:**
- ✅ 투어가 존재하는가?
- ✅ `is_active`가 `true`인가? (API는 `is_active=true`만 반환)
- ✅ `id` 값이 정확한가? (UUID 형식 확인)

### 5. 로컬 vs 프로덕션 데이터베이스 비교

**가능한 시나리오:**

#### 시나리오 A: 다른 Supabase 프로젝트 사용
- 로컬: 개발용 Supabase 프로젝트
- 프로덕션: 다른 프로덕션 Supabase 프로젝트
- **해결:** Vercel 환경 변수가 올바른 프로덕션 Supabase 프로젝트를 가리키는지 확인

#### 시나리오 B: 데이터 동기화 문제
- 로컬에는 투어가 있지만 프로덕션 DB에는 없음
- **해결:** 프로덕션 DB에 투어 데이터 생성 또는 마이그레이션

#### 시나리오 C: is_active 상태 불일치
- 로컬: `is_active=true`
- 프로덕션: `is_active=false`
- **해결:** 프로덕션 DB에서 `is_active`를 `true`로 업데이트

### 6. Next.js 라우팅 확인

**파일 구조:**
```
app/
  tour/
    [id]/
      page.tsx  ✅ 올바른 경로
  api/
    tours/
      [id]/
        route.ts  ✅ 올바른 API 라우트
```

**확인:**
- 빌드 로그에 라우트가 올바르게 인식되는지 확인
- `next build` 시 에러가 없는지 확인

## 🔧 일반적인 해결 방법

### 해결 1: 환경 변수 재설정 및 재배포

1. Vercel Dashboard → Settings → Environment Variables
2. 모든 Supabase 관련 환경 변수 확인
3. 값이 올바른지 재확인
4. **재배포** (Deployments → 최신 배포 → "..." → Redeploy)

### 해결 2: 프로덕션 DB에서 투어 활성화

```sql
-- 투어가 비활성화되어 있는 경우
UPDATE tours 
SET is_active = true 
WHERE id = 'd7691042-120b-4699-90b7-9cd0ac013898';
```

### 해결 3: 프로덕션 DB에 투어 생성

로컬에서 투어를 프로덕션 DB로 복사:

```sql
-- 로컬 DB에서 투어 데이터 확인
SELECT * FROM tours WHERE id = 'd7691042-120b-4699-90b7-9cd0ac013898';

-- 프로덕션 DB에 동일한 데이터 INSERT (Supabase Dashboard SQL Editor 사용)
```

## 📊 진단 체크리스트

- [ ] 프로덕션 API 직접 테스트 (`scripts/test-production-tour-api.js`)
- [ ] Vercel 환경 변수 확인 (3개 모두)
- [ ] Vercel 로그 확인 (Functions 탭)
- [ ] 프로덕션 Supabase DB에서 투어 존재 확인
- [ ] 투어 `is_active` 상태 확인
- [ ] 로컬과 프로덕션 Supabase 프로젝트가 다른지 확인
- [ ] 환경 변수 수정 후 재배포 완료

## 🎯 빠른 진단 명령어

```bash
# 1. 프로덕션 API 테스트
node scripts/test-production-tour-api.js d7691042-120b-4699-90b7-9cd0ac013898

# 2. 로컬 DB에서 투어 확인 (환경 변수 필요)
node scripts/check-tour-in-production.js d7691042-120b-4699-90b7-9cd0ac013898
```

## 🔗 관련 파일

- `app/api/tours/[id]/route.ts` - API 라우트 핸들러
- `app/tour/[id]/page.tsx` - 프론트엔드 페이지
- `lib/supabase.ts` - Supabase 클라이언트 설정
- `scripts/test-production-tour-api.js` - 프로덕션 API 테스트 스크립트
- `scripts/check-tour-in-production.js` - 로컬 DB 진단 스크립트

